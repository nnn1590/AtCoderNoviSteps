import { redirect, type Actions } from '@sveltejs/kit';

import { type Contest, type Task, type ImportTask, TaskGrade, getTaskGrade } from '$lib/types/task';
import * as taskService from '$lib/services/tasks';
import * as userService from '$lib/services/users';
import * as problemApiService from '$lib/services/problemsApiService';

import { sha256 } from '$lib/utils/hash';
import { classifyContest } from '$lib/utils/contest';

import { Roles } from '$lib/types/user';

export async function load({ locals }) {
  const session = await locals.auth.validate();
  if (!session) {
    throw redirect(302, '/login');
  }

  const user = await userService.getUser(session?.user.username as string);
  if (user?.role !== Roles.ADMIN) {
    throw redirect(302, '/login');
  }

  const importContestsJson = await problemApiService.getContests();
  const importTasksJson = await problemApiService.getTasks();
  const tasks = await taskService.getTasks();

  //dbから取得した、contest_id-Task, task_id-Taskのマップ
  const taskContestMap = new Map<string, Task>();
  const taskMap = new Map<string, Task>();
  for (let i = 0; i < tasks.length; i++) {
    taskContestMap.set(tasks[i].contest_id, tasks[i]);
    taskMap.set(tasks[i].task_id, tasks[i]);
  }
  //APIから取得した、contest_id-ImportTaskのマップ
  const unregisteredTasksInContest = new Map<string, ImportTask[]>();

  //対象コンテストに絞る
  // See: src/lib/utils/contest.ts
  for (let i = 0; i < importContestsJson.length; i++) {
    const contest_id = importContestsJson[i].id;
    const contest_type = classifyContest(contest_id);

    if (contest_type === null) {
      continue;
    }

    unregisteredTasksInContest.set(
      contest_id,
      importTasksJson.filter(
        (importTaskJson: ImportTask) =>
          importTaskJson.contest_id == contest_id && !taskMap.has(importTaskJson.id),
      ),
    );
  }

  const importContests = importContestsJson.map((importContestJson: Contest) => {
    return {
      id: importContestJson.id,
      title: importContestJson.title,
      start_epoch_second: importContestJson.start_epoch_second,
      duration_second: importContestJson.duration_second,
      tasks: unregisteredTasksInContest.get(importContestJson.id) ?? [],
    };
  });

  return {
    importContests: importContests,
  };
}

export const actions: Actions = {
  create: async ({ request }) => {
    try {
      console.log('users->actions->generate');
      const formData = await request.formData();
      const contest_id = formData.get('contest_id')?.toString() as string;

      const tasks = await problemApiService.getTasks();
      const tasksByContestId = tasks.filter((task: ImportTask) => task.contest_id === contest_id);

      tasksByContestId.map(async (task: ImportTask) => {
        const id = (await sha256(contest_id + task.title)) as string;
        await taskService.createTask(id, task.id, task.contest_id, task.problem_index, task.title);
      });
    } catch {
      return {
        success: false,
      };
    }

    return {
      success: true,
    };
  },

  update: async ({ request }) => {
    try {
      console.log('users->actions->generate');
      const formData = await request.formData();
      console.log(formData);
      const task_id = formData.get('task_id')?.toString();

      const task_grade_str: string | null = formData.get('task_grade')?.toString() || '';

      //POSTされてこなかった場合は抜ける
      if (task_grade_str === '') {
        return {
          success: true,
        };
      }

      // Assuming getTaskGrade function is defined as mentioned before
      const task_grade: TaskGrade | undefined = task_grade_str
        ? getTaskGrade(task_grade_str)
        : TaskGrade.PENDING;

      if (!task_id || task_grade === undefined) {
        return {
          success: false,
        };
      }

      await taskService.updateTask(task_id, task_grade);
      const contest_id = formData.get('contest_id')?.toString() as string;

      const tasks = await problemApiService.getTasks();

      const tasksByContestId = tasks.filter((task: ImportTask) => task.contest_id === contest_id);

      tasksByContestId.map(async (task: ImportTask) => {
        const id = (await sha256(contest_id + task.title)) as string;
        console.log(id);
        await taskService.createTask(id, task.id, task.contest_id, task.problem_index, task.title);
      });
    } catch {
      return {
        success: false,
      };
    }

    throw redirect(301, '/problems/');
  },
};
