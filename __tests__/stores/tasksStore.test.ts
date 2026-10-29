/**
 * QA — tasksStore (house task list, FEATURES.md 4.4)
 *
 * Locks in the behaviour of the money-adjacent paths:
 *  - addTask validates input (Zod) and never commits state on DB failure
 *  - toggleTask records who completed the task and when, and never
 *    updates state before the DB confirms
 *  - assignTask notifies the assignee (task_assigned) but never notifies
 *    when you assign a task to yourself
 *  - addTask tells the rest of the house a task was added (chore_added),
 *    leaving out you and the assignee (who gets task_assigned instead)
 *  - deleteTask keeps state consistent on failure
 */

import { useTasksStore, type HouseTask } from '../../stores/tasksStore';
import { useAuthStore } from '../../stores/authStore';
import { ok, fail } from '../__helpers__/supabaseMock';

// ── Module mocks ──────────────────────────────────────────────────────────────

const mockFrom = jest.fn();
const mockRpc = jest.fn();

jest.mock('@lib/supabase', () => ({
  supabase: {
    from: (...a: unknown[]): unknown => mockFrom(...a),
    rpc: (...a: unknown[]): unknown => mockRpc(...a),
    channel: jest.fn(() => ({ on: jest.fn().mockReturnThis(), subscribe: jest.fn() })),
    removeChannel: jest.fn(),
  },
}));

const mockCelebrate = jest.fn();
jest.mock('@lib/celebrate', () => ({
  celebrate: (...a: unknown[]): unknown => mockCelebrate(...a),
}));

const mockNotify = jest.fn().mockResolvedValue(undefined);
jest.mock('@lib/notifyHousemates', () => ({
  notifyHousemates: (...a: unknown[]): Promise<void> => mockNotify(...a),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const ME = '11111111-1111-4111-8111-111111111111';
const ALEX = '22222222-2222-4222-8222-222222222222';
const HOUSE = 'house-1';
const SAM = '33333333-3333-4333-8333-333333333333';

// The "task added" push is fired without awaiting; let it run.
const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

function task(overrides: Partial<HouseTask> = {}): HouseTask {
  return {
    id: 't1',
    houseId: HOUSE,
    title: 'Call the landlord',
    description: '',
    priority: 'medium',
    assignedTo: null,
    dueDate: null,
    isComplete: false,
    completedAt: null,
    completedBy: null,
    createdBy: ME,
    createdAt: '2026-07-01T00:00:00Z',
    recurrence: 'once',
    recurrenceDay: null,
    ...overrides,
  };
}

function taskRow(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: 't-new',
    title: 'Call the landlord',
    description: '',
    priority: 'medium',
    assigned_to: null,
    due_date: null,
    is_done: false,
    completed_at: null,
    completed_by: null,
    created_by: ME,
    created_at: '2026-07-01T00:00:00Z',
    recurrence: 'once',
    recurrence_day: null,
    ...overrides,
  };
}

beforeEach(() => {
  useTasksStore.setState({ tasks: [], isLoading: false, error: null });
  useAuthStore.setState({
    houseId: HOUSE,
    profile: { id: ME, name: 'Sam' },
  } as unknown as Partial<ReturnType<typeof useAuthStore.getState>>);
  jest.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// addTask
// ─────────────────────────────────────────────────────────────────────────────

describe('tasksStore — addTask', () => {
  it('rejects an empty title before touching the database (Zod)', async () => {
    await expect(
      useTasksStore.getState().addTask(
        {
          title: '   ',
          description: '',
          priority: 'medium',
          assignedTo: null,
          dueDate: null,
          recurrence: 'once',
          recurrenceDay: null,
        },
        HOUSE
      )
    ).rejects.toThrow();

    expect(mockFrom).not.toHaveBeenCalled();
    expect(useTasksStore.getState().tasks).toHaveLength(0);
  });

  it('rejects a malformed due date before touching the database (Zod)', async () => {
    await expect(
      useTasksStore.getState().addTask(
        {
          title: 'Fix tap',
          description: '',
          priority: 'high',
          assignedTo: null,
          dueDate: 'next tuesday',
          recurrence: 'once',
          recurrenceDay: null,
        },
        HOUSE
      )
    ).rejects.toThrow();

    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('throws and does NOT add to state when DB insert fails', async () => {
    mockFrom.mockReturnValue(fail('RLS denied'));

    await expect(
      useTasksStore.getState().addTask(
        {
          title: 'Fix tap',
          description: '',
          priority: 'medium',
          assignedTo: null,
          dueDate: null,
          recurrence: 'once',
          recurrenceDay: null,
        },
        HOUSE
      )
    ).rejects.toThrow('Could not save the task. Please try again.');

    expect(useTasksStore.getState().tasks).toHaveLength(0);
  });

  it('adds the task to state (newest first) on success', async () => {
    useTasksStore.setState({ tasks: [task({ id: 'older' })] });
    mockFrom.mockReturnValue(ok(taskRow({ id: 't-new', title: 'Fix tap', priority: 'high' })));

    await useTasksStore.getState().addTask(
      {
        title: 'Fix tap',
        description: '',
        priority: 'high',
        assignedTo: null,
        dueDate: null,
        recurrence: 'once',
        recurrenceDay: null,
      },
      HOUSE
    );

    const tasks = useTasksStore.getState().tasks;
    expect(tasks).toHaveLength(2);
    expect(tasks[0].id).toBe('t-new');
    expect(tasks[0].priority).toBe('high');
    await flush();
    // No assignee → the whole house (except me) hears it was added.
    expect(mockNotify).toHaveBeenCalledTimes(1);
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({
        houseId: HOUSE,
        excludeUserId: ME,
        includeUserIds: undefined,
        copyKey: 'chore_added',
        copyParams: expect.objectContaining({ choreName: 'Fix tap' }),
        notificationType: 'chore_overdue',
      })
    );
  });

  it('gives the assignee their own message and tells everyone else it was added', async () => {
    mockFrom.mockReturnValueOnce(ok(taskRow({ assigned_to: ALEX, title: 'Fix tap' })));
    mockFrom.mockReturnValueOnce(ok([{ user_id: ME }, { user_id: ALEX }, { user_id: SAM }]));

    await useTasksStore.getState().addTask(
      {
        title: 'Fix tap',
        description: '',
        priority: 'medium',
        assignedTo: ALEX,
        dueDate: null,
        recurrence: 'once',
        recurrenceDay: null,
      },
      HOUSE
    );

    await flush();
    expect(mockNotify).toHaveBeenCalledTimes(2);
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({
        houseId: HOUSE,
        includeUserIds: [ALEX],
        notificationType: 'task_assigned',
      })
    );
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({ includeUserIds: [SAM], copyKey: 'chore_added' })
    );
  });

  it('sends no "added" message when the assignee is the only other housemate', async () => {
    mockFrom.mockReturnValueOnce(ok(taskRow({ assigned_to: ALEX, title: 'Fix tap' })));
    mockFrom.mockReturnValueOnce(ok([{ user_id: ME }, { user_id: ALEX }]));

    await useTasksStore.getState().addTask(
      {
        title: 'Fix tap',
        description: '',
        priority: 'medium',
        assignedTo: ALEX,
        dueDate: null,
        recurrence: 'once',
        recurrenceDay: null,
      },
      HOUSE
    );

    await flush();
    expect(mockNotify).toHaveBeenCalledTimes(1);
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({ notificationType: 'task_assigned' })
    );
  });

  it('does not duplicate the task when a realtime reload already added it', async () => {
    // The realtime channel can commit the inserted row before the insert
    // response returns — the prepend must replace it, not duplicate it.
    useTasksStore.setState({
      tasks: [task({ id: 't-new', title: 'Fix tap' }), task({ id: 'older' })],
    });
    mockFrom.mockReturnValue(ok(taskRow({ id: 't-new', title: 'Fix tap' })));

    await useTasksStore.getState().addTask(
      {
        title: 'Fix tap',
        description: '',
        priority: 'medium',
        assignedTo: null,
        dueDate: null,
        recurrence: 'once',
        recurrenceDay: null,
      },
      HOUSE
    );

    const ids = useTasksStore.getState().tasks.map((t) => t.id);
    expect(ids).toEqual(['t-new', 'older']); // no duplicate
  });

  it('sends no "gave you a task" message when I assign the task to myself', async () => {
    mockFrom.mockReturnValue(ok(taskRow({ assigned_to: ME })));

    await useTasksStore.getState().addTask(
      {
        title: 'Fix tap',
        description: '',
        priority: 'medium',
        assignedTo: ME,
        dueDate: null,
        recurrence: 'once',
        recurrenceDay: null,
      },
      HOUSE
    );

    await flush();
    expect(mockNotify).not.toHaveBeenCalledWith(
      expect.objectContaining({ notificationType: 'task_assigned' })
    );
    // The rest of the house still hears it was added.
    expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({ copyKey: 'chore_added' }));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// toggleTask
// ─────────────────────────────────────────────────────────────────────────────

describe('tasksStore — toggleTask', () => {
  it('is a no-op when the task id is not found in state', async () => {
    useTasksStore.setState({ tasks: [task({ id: 't1' })] });

    await useTasksStore.getState().toggleTask('nonexistent');

    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('marks the task complete and records who completed it and when', async () => {
    useTasksStore.setState({ tasks: [task({ id: 't1', isComplete: false })] });
    mockFrom.mockReturnValue(ok({ id: 't1' }));

    await useTasksStore.getState().toggleTask('t1');

    const updated = useTasksStore.getState().tasks[0];
    expect(updated.isComplete).toBe(true);
    expect(updated.completedAt).not.toBeNull();
    expect(updated.completedBy).toBe(ME);
  });

  it('has Mate celebrate when the last open task is done', async () => {
    mockCelebrate.mockClear();
    useTasksStore.setState({
      tasks: [task({ id: 't1' }), task({ id: 't2', isComplete: true })],
    });
    mockFrom.mockReturnValue(ok({ id: 't1' }));

    await useTasksStore.getState().toggleTask('t1');

    expect(mockCelebrate).toHaveBeenCalledWith('tasks');
  });

  it('does not celebrate while other tasks are still open', async () => {
    mockCelebrate.mockClear();
    useTasksStore.setState({ tasks: [task({ id: 't1' }), task({ id: 't2' })] });
    mockFrom.mockReturnValue(ok({ id: 't1' }));

    await useTasksStore.getState().toggleTask('t1');

    expect(mockCelebrate).not.toHaveBeenCalled();
  });

  it('keeps the completed task in state (history) rather than removing it', async () => {
    useTasksStore.setState({ tasks: [task({ id: 't1' })] });
    mockFrom.mockReturnValue(ok({ id: 't1' }));

    await useTasksStore.getState().toggleTask('t1');

    expect(useTasksStore.getState().tasks).toHaveLength(1);
  });

  it('un-completes and clears completedAt/completedBy when toggled back', async () => {
    useTasksStore.setState({
      tasks: [
        task({
          id: 't1',
          isComplete: true,
          completedAt: '2026-07-10T10:00:00Z',
          completedBy: ALEX,
        }),
      ],
    });
    mockFrom.mockReturnValue(ok({ id: 't1' }));

    await useTasksStore.getState().toggleTask('t1');

    const updated = useTasksStore.getState().tasks[0];
    expect(updated.isComplete).toBe(false);
    expect(updated.completedAt).toBeNull();
    expect(updated.completedBy).toBeNull();
  });

  it('throws and leaves state unchanged when DB update fails', async () => {
    useTasksStore.setState({ tasks: [task({ id: 't1', isComplete: false })] });
    mockFrom.mockReturnValue(fail('write failed'));

    await expect(useTasksStore.getState().toggleTask('t1')).rejects.toThrow(
      'Could not update the task. Please try again.'
    );

    expect(useTasksStore.getState().tasks[0].isComplete).toBe(false); // unchanged
  });

  it('throws and leaves state unchanged when the DB matched no row (deleted elsewhere / RLS)', async () => {
    useTasksStore.setState({ tasks: [task({ id: 't1', isComplete: false })] });
    mockFrom.mockReturnValue(ok(null)); // update succeeded but touched 0 rows

    await expect(useTasksStore.getState().toggleTask('t1')).rejects.toThrow(
      'Could not update the task. Please try again.'
    );

    expect(useTasksStore.getState().tasks[0].isComplete).toBe(false); // unchanged
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// assignTask
// ─────────────────────────────────────────────────────────────────────────────

describe('tasksStore — assignTask', () => {
  it('sets assignedTo and notifies the new assignee', async () => {
    useTasksStore.setState({ tasks: [task({ id: 't1', assignedTo: null })] });
    mockFrom.mockReturnValue(ok({ id: 't1' }));

    await useTasksStore.getState().assignTask('t1', ALEX);

    expect(useTasksStore.getState().tasks[0].assignedTo).toBe(ALEX);
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({ includeUserIds: [ALEX], notificationType: 'task_assigned' })
    );
  });

  it('clears the assignee without sending any notification', async () => {
    useTasksStore.setState({ tasks: [task({ id: 't1', assignedTo: ALEX })] });
    mockFrom.mockReturnValue(ok({ id: 't1' }));

    await useTasksStore.getState().assignTask('t1', null);

    expect(useTasksStore.getState().tasks[0].assignedTo).toBeNull();
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('throws and leaves assignedTo unchanged when DB update fails', async () => {
    useTasksStore.setState({ tasks: [task({ id: 't1', assignedTo: null })] });
    mockFrom.mockReturnValue(fail('connection error'));

    await expect(useTasksStore.getState().assignTask('t1', ALEX)).rejects.toThrow(
      'Could not assign the task. Please try again.'
    );

    expect(useTasksStore.getState().tasks[0].assignedTo).toBeNull(); // unchanged
    expect(mockNotify).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// deleteTask
// ─────────────────────────────────────────────────────────────────────────────

describe('tasksStore — deleteTask', () => {
  it('removes the task from state on success', async () => {
    useTasksStore.setState({ tasks: [task({ id: 't1' })] });
    mockFrom.mockReturnValue(ok({ id: 't1' }));

    await useTasksStore.getState().deleteTask('t1');

    expect(useTasksStore.getState().tasks).toHaveLength(0);
  });

  it('throws and keeps the task in state when DB delete fails', async () => {
    useTasksStore.setState({ tasks: [task({ id: 't1' })] });
    mockFrom.mockReturnValue(fail('RLS denied'));

    await expect(useTasksStore.getState().deleteTask('t1')).rejects.toThrow(
      'Could not delete the task. Please try again.'
    );

    expect(useTasksStore.getState().tasks).toHaveLength(1); // unchanged
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Repeating tasks (merged in from Chores)
// ─────────────────────────────────────────────────────────────────────────────

describe('tasksStore — repeating tasks', () => {
  it('saves the repeat setting with a new task', async () => {
    const chain = ok(taskRow({ recurrence: 'weekly', recurrence_day: 'Thu' }));
    mockFrom.mockReturnValue(chain);

    await useTasksStore.getState().addTask(
      {
        title: 'Bins',
        description: '',
        priority: 'medium',
        assignedTo: null,
        dueDate: null,
        recurrence: 'weekly',
        recurrenceDay: 'Thu',
      },
      HOUSE
    );

    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ recurrence: 'weekly', recurrence_day: 'Thu' })
    );
    expect(useTasksStore.getState().tasks[0]).toMatchObject({
      recurrence: 'weekly',
      recurrenceDay: 'Thu',
    });
  });

  it('never stores a repeat day on a one-off task', async () => {
    const chain = ok(taskRow());
    mockFrom.mockReturnValue(chain);

    await useTasksStore.getState().addTask(
      {
        title: 'Fix tap',
        description: '',
        priority: 'medium',
        assignedTo: null,
        dueDate: null,
        recurrence: 'once',
        recurrenceDay: 'Mon',
      },
      HOUSE
    );

    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ recurrence: 'once', recurrence_day: null })
    );
  });

  it('reset un-ticks only repeating tasks and keeps one-off history', async () => {
    useTasksStore.setState({
      tasks: [
        task({ id: 'r', recurrence: 'weekly', isComplete: true, completedBy: ME }),
        task({ id: 'o', recurrence: 'once', isComplete: true, completedBy: ME }),
      ],
    });
    mockRpc.mockResolvedValue({ error: null });

    await useTasksStore.getState().resetRepeating(HOUSE);

    expect(mockRpc).toHaveBeenCalledWith('reset_repeating_tasks', { p_house_id: HOUSE });
    const byId = Object.fromEntries(useTasksStore.getState().tasks.map((t) => [t.id, t]));
    expect(byId.r).toMatchObject({ isComplete: false, completedBy: null, completedAt: null });
    expect(byId.o).toMatchObject({ isComplete: true, completedBy: ME });
  });

  it("reset leaves another house's tasks alone", async () => {
    useTasksStore.setState({
      tasks: [
        task({ id: 'mine', recurrence: 'weekly', isComplete: true, completedBy: ME }),
        task({ id: 'old', houseId: 'house-2', recurrence: 'weekly', isComplete: true }),
      ],
    });
    mockRpc.mockResolvedValue({ error: null });

    await useTasksStore.getState().resetRepeating(HOUSE);

    const byId = Object.fromEntries(useTasksStore.getState().tasks.map((t) => [t.id, t]));
    expect(byId.mine.isComplete).toBe(false);
    expect(byId.old.isComplete).toBe(true);
  });

  it('reset throws and changes nothing when the database fails', async () => {
    useTasksStore.setState({ tasks: [task({ id: 'r', recurrence: 'weekly', isComplete: true })] });
    mockRpc.mockResolvedValue({ error: { message: 'connection error' } });

    await expect(useTasksStore.getState().resetRepeating(HOUSE)).rejects.toThrow(
      'Could not reset the repeating tasks. Please try again.'
    );
    expect(useTasksStore.getState().tasks[0].isComplete).toBe(true);
  });
});
