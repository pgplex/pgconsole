import { useState } from 'react';
import { Avatar, AvatarFallback } from './ui/avatar';

interface UserAvatarProps {
  user?: { name?: string | null; email?: string | null; avatar?: string | null } | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

export default function UserAvatar({ user, size = 'md', className }: UserAvatarProps) {
  const [erroredUrl, setErroredUrl] = useState<string | null>(null);
  const avatarUrl = user?.avatar;
  const initial = (user?.name || user?.email || 'U').charAt(0).toUpperCase();

  const sizeClasses = {
    xs: 'size-6 text-xs',
    sm: 'size-8 text-xs',
    md: 'size-10 text-sm',
    lg: 'size-12 text-base',
  };

  const showImage = avatarUrl && avatarUrl !== erroredUrl;

  return (
    <Avatar className={`${sizeClasses[size]} ${className || ''}`}>
      {showImage ? (
        <img
          src={avatarUrl}
          alt={user?.name || user?.email || 'User'}
          className="size-full object-cover"
          onError={() => setErroredUrl(avatarUrl)}
        />
      ) : (
        <AvatarFallback className="bg-gray-200 text-gray-600">
          {initial}
        </AvatarFallback>
      )}
    </Avatar>
  );
}
