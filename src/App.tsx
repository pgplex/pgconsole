import { useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import SignIn from './components/SignIn';
import Header from './components/Header';
import { useSession } from './lib/auth-client';
import { SQLEditorLayout } from './components/sql-editor';
import { useConnections } from './hooks/useQuery';
import { ToastProvider, toastManager } from './components/ui/toast';
import { useEditorTabs } from './components/sql-editor/hooks/useEditorTabs';
import { useEditorNavigation } from './hooks/useEditorNavigation';
import { Button } from './components/ui/button';
import { Banner } from './components/Banner';
import { useSetting } from './hooks/useSetting';
import { SubscriptionModalProvider } from './components/SubscriptionModal';
import { LicenseExpiryBanner } from './components/LicenseExpiryBanner';
import { DemoBanner } from './components/DemoBanner';

function AppLayout() {
  const { user, isPending: sessionPending, serverError, authEnabled } = useSession();
  const { data: connections } = useConnections();
  const { banner, demo } = useSetting();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const hasShownInvalidToast = useRef(false);

  const connectionIdFromUrl = searchParams.get('connectionId');
  const isEditorRoute = location.pathname === '/';
  const isSignInRoute = location.pathname === '/signin';

  const selectedConnectionId = (() => {
    if (!connections || connections.length === 0) return '';
    if (connectionIdFromUrl && connections.some(c => c.id === connectionIdFromUrl)) {
      return connectionIdFromUrl;
    }
    return connections[0].id;
  })();

  // Centralized URL state management - handles defaults and redirects
  const navigation = useEditorNavigation(selectedConnectionId);

  const editorTabs = useEditorTabs(selectedConnectionId);

  // Validate connection ID and redirect if invalid
  useEffect(() => {
    if (!connections || connections.length === 0 || !isEditorRoute) return;

    const isValidConnection = connectionIdFromUrl && connections.some(c => c.id === connectionIdFromUrl);

    if (!connectionIdFromUrl) {
      navigate(`/?connectionId=${connections[0].id}`, { replace: true });
    } else if (!isValidConnection) {
      if (!hasShownInvalidToast.current) {
        hasShownInvalidToast.current = true;
        toastManager.add({
          title: 'Connection not found',
          description: `Connection "${connectionIdFromUrl}" does not exist`,
          type: 'error',
        });
      }
      navigate(`/?connectionId=${connections[0].id}`, { replace: true });
    }
  }, [connections, connectionIdFromUrl, isEditorRoute, navigate]);

  if (sessionPending) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-white">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  // Show error screen when server is unreachable
  if (serverError) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-white">
        <div className="text-center space-y-4 max-w-md px-4">
          <AlertCircle className="mx-auto text-red-500" size={48} />
          <h1 className="text-xl font-semibold text-gray-900">Cannot connect to server</h1>
          <p className="text-gray-600">
            The backend server is not responding. Please make sure the server is running.
          </p>
          <Button onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const needsAuth = authEnabled && !user;

  // Redirect to signin if auth is required but user not logged in
  if (needsAuth && !isSignInRoute) {
    return <Navigate to="/signin" replace />;
  }

  // Redirect away from signin if already logged in
  if (user && isSignInRoute) {
    return <Navigate to="/" replace />;
  }

  return (
    <ToastProvider>
      <SubscriptionModalProvider>
        <div className="flex flex-col h-screen w-screen overflow-hidden bg-white">
          {!isSignInRoute && demo && <DemoBanner />}
          {!isSignInRoute && banner?.text && (
            <Banner text={banner.text} link={banner.link} color={banner.color} />
          )}
          {!isSignInRoute && <LicenseExpiryBanner />}
          {!isSignInRoute && <Header selectedConnectionId={selectedConnectionId} />}
          <div className="flex flex-1 overflow-hidden">
            <Routes>
              <Route path="/" element={
                  <SQLEditorLayout
                    connectionId={selectedConnectionId}
                    editorTabs={editorTabs}
                    selectedSchema={navigation.schema}
                    selectedObject={navigation.object}
                    onSchemaChange={navigation.setSchema}
                    onObjectSelect={navigation.setObject}
                    schemas={navigation.schemas}
                    tables={navigation.tables}
                    isSchemasLoading={navigation.isSchemasLoading}
                    isTablesLoading={navigation.isTablesLoading}
                    schemasError={navigation.schemasError}
                    tablesError={navigation.tablesError}
                  />
                } />
              <Route path="/signin" element={
                <div className="flex flex-1 items-center justify-center">
                  <SignIn />
                </div>
              } />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </div>
      </SubscriptionModalProvider>
    </ToastProvider>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}

export default App;
