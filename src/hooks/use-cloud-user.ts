import { useEffect, useState } from 'react';

import { type CloudUser, getCurrentUser, onAuthChange } from '@/lib/cloud';

/** 当前登录的账号；登录、退出、删除账号后自动更新。 */
export function useCloudUser(): { user: CloudUser | null; loading: boolean } {
  const [state, setState] = useState<{ user: CloudUser | null; loading: boolean }>({ user: null, loading: true });

  useEffect(() => {
    let alive = true;
    const load = () => {
      getCurrentUser()
        .then((user) => alive && setState({ user, loading: false }))
        .catch(() => alive && setState({ user: null, loading: false }));
    };
    load();
    const unsubscribe = onAuthChange(load);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  return state;
}
