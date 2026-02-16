import { useNavigate } from 'react-router-dom';
import { LogOut, CreditCard } from 'lucide-react';
import { ConnectionSwitcher } from './ConnectionSwitcher';
import { Menu, MenuTrigger, MenuPopup, MenuItem } from './ui/menu';
import { useSession, signOut } from '@/lib/auth-client';
import { useSubscriptionModal } from '@/hooks/useSubscriptionModal';
import { useOwner } from '@/hooks/useOwner';
import UserAvatar from './UserAvatar';
import logoFull from '@/assets/logo-light-full.svg';

interface HeaderProps {
  selectedConnectionId: string
}

export default function Header({ selectedConnectionId }: HeaderProps) {
  const navigate = useNavigate();
  const { user, authEnabled } = useSession();
  const subscriptionModal = useSubscriptionModal();
  const isOwner = useOwner();

  const isGuest = user?.email === 'guest';
  const showSignIn = !user && authEnabled;

  const handleSignOut = async () => {
    await signOut();
    window.location.href = '/signin';
  };

  return (
    <header className="h-12 bg-gray-100 border-b border-gray-300 flex items-center px-3 justify-between">
      <ConnectionSwitcher selectedConnectionId={selectedConnectionId} />

      <div className="flex items-center gap-1.5">
        <button
          onClick={() => window.open('https://docs.pgconsole.com', '_blank')}
          className="flex items-center justify-center hover:opacity-80"
          aria-label="Documentation"
        >
          <img src={logoFull} alt="pgconsole docs" className="h-7.5" />
        </button>

        {user && !isGuest ? (
          <Menu>
            <MenuTrigger
              render={
                <button
                  className="flex items-center hover:opacity-80 transition-opacity"
                  aria-label="User menu"
                >
                  <UserAvatar user={user} size="sm" />
                </button>
              }
            />
            <MenuPopup align="end" side="bottom">
              <div className="px-3 py-2 border-b border-gray-200">
                <div className="text-sm font-medium text-gray-900">{user.name}</div>
                <div className="text-xs text-gray-500">
                  {user.name !== user.email && <span>{user.email}</span>}
                  {isOwner && <span className="ml-1 text-blue-600 font-medium">(Owner)</span>}
                </div>
              </div>
              {isOwner && (
                <MenuItem onClick={() => subscriptionModal.open()}>
                  <CreditCard size={14} />
                  Subscription
                </MenuItem>
              )}
              <MenuItem onClick={handleSignOut}>
                <LogOut size={14} />
                Sign Out
              </MenuItem>
              <div className="px-3 py-2 border-t border-gray-200">
                <div className="text-xs text-gray-400">
                  v{__APP_VERSION__} ({__GIT_COMMIT__}) &middot; {new Date(__BUILD_DATE__).toLocaleDateString()}
                </div>
              </div>
            </MenuPopup>
          </Menu>
        ) : showSignIn ? (
          <button
            className="text-xs text-gray-500 hover:text-gray-700 transition-colors px-2"
            onClick={() => navigate('/signin')}
          >
            Sign In
          </button>
        ) : null}
      </div>
    </header>
  );
}
