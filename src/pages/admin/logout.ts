import type {APIRoute} from 'astro'; import {logout,SESSION_COOKIE_NAME,originOk} from '../../lib/auth';
export const POST:APIRoute=({cookies,request,redirect})=>{if(!originOk(request))return new Response('Forbidden',{status:403});logout(cookies,cookies.get(SESSION_COOKIE_NAME)?.value);return redirect('/admin/login',303)};
