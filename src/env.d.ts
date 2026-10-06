/// <reference types="astro/client" />

import type { SessionUser } from './lib/auth';

declare global {
  namespace App {
    interface Locals {
      user?: SessionUser;
    }
  }
}

export {};
