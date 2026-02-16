import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import AuthForm from './AuthForm';

interface AuthLayoutProps {
  title: string;
  description: string;
}

export default function AuthLayout({ title, description }: AuthLayoutProps) {
  return (
    <div className="w-full max-w-md p-4">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <AuthForm onSuccess={() => { window.location.href = '/' }} />
        </CardContent>
      </Card>
    </div>
  );
}
