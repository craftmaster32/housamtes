import { useMemo } from 'react';
import { type HouseTask, type TaskFilter } from '@stores/tasksStore';
import { useCalmMove } from '@hooks/useCalmMove';

// Rows of the to-do pad: tasks, and the handwritten "3 done" before the done ones.
// `leaving` / `arriving` fold a row out of its group and into the other one.
export type PadItem =
  | { _k: 'task'; task: HouseTask; leaving: boolean; arriving: boolean }
  | { _k: 'done-header'; count: number; leaving: boolean; arriving: boolean };

const isTaskDone = (task: HouseTask): boolean => task.isComplete;

/** The rows of the Tasks to-do pad for the chosen tab, with calm moves. */
export function useTaskPadRows(tasks: HouseTask[], filter: TaskFilter): PadItem[] {
  // A ticked task stays where it is for a beat, then folds down under "done"
  // (or off the Active tab), so the pad doesn't jump on every tick.
  const { isShownDone, leavingIds, arrivingIds } = useCalmMove(tasks, isTaskDone);

  return useMemo((): PadItem[] => {
    const shownActive = tasks.filter((tk) => !isShownDone(tk));
    const shownDone = tasks.filter((tk) => isShownDone(tk));
    const rows = (list: HouseTask[]): PadItem[] =>
      list.map((task) => ({
        _k: 'task',
        task,
        leaving: leavingIds.has(task.id),
        arriving: arrivingIds.has(task.id),
      }));
    if (filter === 'active') return rows(shownActive);
    if (filter === 'completed') return rows(shownDone);
    const header: PadItem[] =
      shownDone.length > 0
        ? [
            {
              _k: 'done-header',
              count: shownDone.length,
              // The heading folds in / out together with its last tasks.
              leaving: shownDone.every((tk) => leavingIds.has(tk.id)),
              arriving: shownDone.every((tk) => arrivingIds.has(tk.id)),
            },
          ]
        : [];
    return [...rows(shownActive), ...header, ...rows(shownDone)];
  }, [filter, tasks, isShownDone, leavingIds, arrivingIds]);
}
