import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { supabase } from '@lib/supabase';
import { notifyHousemates } from '@lib/notifyHousemates';
import { captureError } from '@lib/errorTracking';
import { useAuthStore } from '@stores/authStore';
import { houseTaskSchema } from '@utils/validation';

export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskFilter = 'all' | 'active' | 'completed';

export interface HouseTask {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  assignedTo: string | null; // user UUID
  dueDate: string | null; // YYYY-MM-DD
  isComplete: boolean;
  completedAt: string | null;
  completedBy: string | null; // user UUID
  createdBy: string; // user UUID
  createdAt: string;
}

export interface NewTaskInput {
  title: string;
  description: string;
  priority: TaskPriority;
  assignedTo: string | null;
  dueDate: string | null;
}

interface TasksStore {
  tasks: HouseTask[];
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
  load: (houseId: string) => Promise<void>;
  unsubscribe: () => void;
  addTask: (input: NewTaskInput, houseId: string) => Promise<void>;
  toggleTask: (id: string) => Promise<void>;
  assignTask: (id: string, userId: string | null) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
}

function rowToTask(r: Record<string, unknown>): HouseTask {
  return {
    id: r.id as string,
    title: r.title as string,
    description: (r.description ?? '') as string,
    priority: (r.priority ?? 'medium') as TaskPriority,
    assignedTo: (r.assigned_to ?? null) as string | null,
    dueDate: (r.due_date ?? null) as string | null,
    isComplete: (r.is_done ?? false) as boolean,
    completedAt: (r.completed_at ?? null) as string | null,
    completedBy: (r.completed_by ?? null) as string | null,
    createdBy: r.created_by as string,
    createdAt: r.created_at as string,
  };
}

/** Notify the assignee that a task landed on their plate (Phase 6). */
function notifyAssignee(houseId: string, assignedTo: string, taskTitle: string): void {
  const me = useAuthStore.getState().profile;
  if (!me?.id || assignedTo === me.id) return; // never notify yourself
  void notifyHousemates({
    houseId,
    excludeUserId: me.id,
    includeUserIds: [assignedTo],
    title: '📋 New task for you',
    body: `${me.name ?? 'A housemate'} assigned you "${taskTitle}"`,
    data: { screen: 'tasks' },
    notificationType: 'task_assigned',
  }).catch((err) => captureError(err, { context: 'notify-task-assigned', houseId }));
}

let _channel: ReturnType<typeof supabase.channel> | null = null;
let _channelHouseId: string | null = null;
// Bumped on every load() and unsubscribe(). An in-flight load compares its own
// sequence number against this before committing state or (re)subscribing, so a
// stale load can neither overwrite newer data nor recreate a channel after cleanup.
let _loadSeq = 0;

export const useTasksStore = create<TasksStore>()(
  devtools(
    (set, get) => ({
      tasks: [],
      isLoading: true,
      error: null,
      clearError: (): void => set({ error: null }),
      load: async (houseId: string): Promise<void> => {
        if (houseId !== useAuthStore.getState().houseId) {
          console.warn('[tasks] house ID mismatch — aborting load');
          set({ isLoading: false });
          return;
        }
        const seq = ++_loadSeq;
        try {
          const { data, error } = await supabase
            .from('house_tasks')
            .select('*')
            .eq('house_id', houseId)
            .order('created_at', { ascending: false });
          if (error) throw error;
          const tasks: HouseTask[] = (data ?? []).map(rowToTask);
          // A newer load (or unsubscribe) superseded this one — drop its result.
          if (seq !== _loadSeq) return;
          set({ tasks, isLoading: false, error: null });
        } catch (err) {
          captureError(err, { store: 'tasks', houseId });
          // A newer load (or unsubscribe) superseded this one — drop its result.
          if (seq !== _loadSeq) return;
          set({ isLoading: false, error: 'Could not load tasks. Please try again.' });
        }

        // Superseded by a newer load or an unsubscribe while fetching — leave the
        // existing subscription (if any) untouched and never recreate one here.
        if (seq !== _loadSeq) return;
        // Already subscribed for this house: realtime-triggered reloads must not
        // tear the channel down and recreate it on every event.
        if (_channel && _channelHouseId === houseId) return;
        if (_channel) {
          supabase.removeChannel(_channel);
        }
        _channelHouseId = houseId;
        _channel = supabase
          .channel(`house_tasks:${houseId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'house_tasks',
              filter: `house_id=eq.${houseId}`,
            },
            () => {
              get().load(houseId);
            }
          )
          .subscribe();
      },
      unsubscribe: (): void => {
        // Invalidate any in-flight load so it cannot resubscribe after this cleanup.
        _loadSeq++;
        if (_channel) {
          supabase.removeChannel(_channel);
          _channel = null;
          _channelHouseId = null;
        }
      },
      addTask: async (input, houseId): Promise<void> => {
        const parsed = houseTaskSchema.parse({ ...input, houseId });
        const userId = useAuthStore.getState().profile?.id ?? '';
        let task: HouseTask;
        try {
          const res = await supabase
            .from('house_tasks')
            .insert({
              house_id: houseId,
              title: parsed.title,
              description: parsed.description,
              priority: parsed.priority,
              assigned_to: parsed.assignedTo,
              due_date: parsed.dueDate,
              created_by: userId,
            })
            .select()
            .single();
          if (res.error) throw res.error;
          task = rowToTask(res.data as Record<string, unknown>);
        } catch (err) {
          captureError(err, { context: 'add-task', houseId });
          throw new Error('Could not save the task. Please try again.');
        }
        set({ tasks: [task, ...get().tasks] });
        if (task.assignedTo) {
          notifyAssignee(houseId, task.assignedTo, task.title);
        }
      },
      toggleTask: async (id): Promise<void> => {
        const task = get().tasks.find((t) => t.id === id);
        if (!task) return;
        const isDone = !task.isComplete;
        const myId = useAuthStore.getState().profile?.id ?? null;
        const completedAt = isDone ? new Date().toISOString() : null;
        const completedBy = isDone ? myId : null;
        try {
          const { error } = await supabase
            .from('house_tasks')
            .update({ is_done: isDone, completed_at: completedAt, completed_by: completedBy })
            .eq('id', id);
          if (error) throw error;
        } catch (err) {
          captureError(err, { context: 'toggle-task', taskId: id });
          throw new Error('Could not update the task. Please try again.');
        }
        set({
          tasks: get().tasks.map((t) =>
            t.id === id ? { ...t, isComplete: isDone, completedAt, completedBy } : t
          ),
        });
      },
      assignTask: async (id, userId): Promise<void> => {
        const task = get().tasks.find((t) => t.id === id);
        if (!task) return;
        try {
          const { error } = await supabase
            .from('house_tasks')
            .update({ assigned_to: userId })
            .eq('id', id);
          if (error) throw error;
        } catch (err) {
          captureError(err, { context: 'assign-task', taskId: id });
          throw new Error('Could not assign the task. Please try again.');
        }
        set({ tasks: get().tasks.map((t) => (t.id === id ? { ...t, assignedTo: userId } : t)) });
        const houseId = useAuthStore.getState().houseId;
        if (userId && houseId) {
          notifyAssignee(houseId, userId, task.title);
        }
      },
      deleteTask: async (id): Promise<void> => {
        try {
          const { error } = await supabase.from('house_tasks').delete().eq('id', id);
          if (error) throw error;
        } catch (err) {
          captureError(err, { context: 'delete-task', taskId: id });
          throw new Error('Could not delete the task. Please try again.');
        }
        set({ tasks: get().tasks.filter((t) => t.id !== id) });
      },
    }),
    { name: 'tasks-store' }
  )
);
