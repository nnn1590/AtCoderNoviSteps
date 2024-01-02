//See https://tech-blog.rakus.co.jp/entry/20230209/sveltekit#%E3%82%B9%E3%83%AC%E3%83%83%E3%83%89%E6%8A%95%E7%A8%BF%E7%94%BB%E9%9D%A2

import type { Roles } from '$lib/types/user';
import * as userService from '$lib/services/users';
import * as validationService from '$lib/services/validateApiService';
import type { Actions } from './$types';

import { redirect } from '@sveltejs/kit';

//export let action_result = false;
//export let action_result_message = "";

export async function load({ locals }) {
  const session = await locals.auth.validate();
  if (!session) {
    throw redirect(302, '/login');
  }

  try {
    console.log('load');
    const user = await userService.getUser(session?.user.username as string);

    return {
      userId: user?.id as string,
      username: user?.username as string,
      role: user?.role as Roles,
      isLoggedIn: (session?.user.userId === user?.id) as boolean,
      atcoder_username: user?.atcoder_username as string,
      atcoder_validationcode: user?.atcoder_validation_code as string,
      is_validated: user?.atcoder_validation_status as boolean,
      message_type: '',
      message: '',
    };
  } catch (e) {
    console.log("Can't find usrname:", session?.user.username);
    throw redirect(302, '/login');
  }
}

export const actions: Actions = {
  generate: async ({ request }) => {
    console.log('users->actions->generate');
    const formData = await request.formData();
    //console.log(formData);
    const username = formData.get('username')?.toString() as string;
    const atcoder_username = formData.get('atcoder_username')?.toString() as string;

    //console.log('ここにvalidationCodeを作成してデータベースに登録するコードを書きます');
    const validationCode = await validationService.generate(username, atcoder_username);
    //console.log(validationCode);

    return {
      success: true,
      username: username,
      atcoder_username: atcoder_username,
      atcoder_validationcode: validationCode,
      is_tab_atcoder: true,
    };
  },

  validate: async ({ request }) => {
    console.log('users->actions->validate');
    const formData = await request.formData();
    //console.log(formData);
    const username = formData.get('username')?.toString() as string;
    const atcoder_username = formData.get('atcoder_username')?.toString() as string;
    const atcoder_validationcode = formData.get('atcoder_validationcode')?.toString() as string;

    //console.log('validateを呼び、AtCoderの所属欄とAPI呼び出した結果が一致しているかを確認');
    const is_validated = await validationService.validate(username);

    return {
      success: is_validated,
      user: {
        username: username,
        atcoder_username: atcoder_username,
        atcoder_validationcode: atcoder_validationcode,
        message_type: 'green',
        message: 'Successfuly validated.',
      },
    };
  },

  reset: async ({ request }) => {
    console.log('users->actions->edit');
    const formData = await request.formData();
    //console.log(formData);
    const username = formData.get('username')?.toString() as string;
    const atcoder_username = formData.get('atcoder_username')?.toString() as string;

    //console.log('AtCoderのユーザ名とValicationCodeをリセットする。');
    const validationCode = await validationService.reset(username);
    //console.log(validationCode);

    return {
      success: true,
      username: username,
      atcoder_username: atcoder_username,
      atcoder_validationcode: validationCode,
      message_type: 'green',
      message: 'Successfuly reset.',
    };
  },

  delete: async ({ request }) => {
    console.log('users->actions->delete');
    const formData = await request.formData();
    console.log(formData);
    const username = formData.get('username')?.toString() as string;
    const atcoder_username = formData.get('atcoder_username')?.toString() as string;

    console.log('TOdoユーザを削除するコードを書きます');
    //const validationCode = await validationService.generate(username, atcoder_username);
    //console.log(validationCode);

    return {
      success: true,
      username: username,
      atcoder_username: atcoder_username,
      atcoder_validationcode: false,
      message_type: 'green',
      message: 'Successfuly deleted.',
    };
  },
};
