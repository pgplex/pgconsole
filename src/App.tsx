import { useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import SignIn from './components/SignIn';
import Header from './components/Header';
import { useSession } from './lib/auth-client';
import { SQLEditorLayout } from './components/sql-editor';
import AuditLog from './pages/AuditLog';
import { useConnections } from './hooks/useQuery';
import { ToastProvider, toastManager } from './components/ui/toast';
import { useEditorTabs } from './components/sql-editor/hooks/useEditorTabs';
import { useEditorNavigation } from './hooks/useEditorNavigation';
import { Button } from './components/ui/button';
import { Banner } from './components/Banner';
import { useSetting } from './hooks/useSetting';
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
  const isAuditLogRoute = location.pathname === '/audit-log';
  const isSignInRoute = location.pathname === '/signin';
  // Routes that are scoped to a connection via the connectionId query param.
  const isConnectionScopedRoute = isEditorRoute || isAuditLogRoute;

  const selectedConnectionId = (() => {
    if (!connections || connections.length === 0) return '';
    if (connectionIdFromUrl && connections.some(c => c.id === connectionIdFromUrl)) {
      return connectionIdFromUrl;
    }
    return connections[0].id;
  })();

  // Centralized URL state management - handles defaults and redirects.
  // Only active on the editor route so it doesn't write editor params
  // (schema/object) or fetch schemas while on other connection-scoped routes.
  const navigation = useEditorNavigation(selectedConnectionId, isEditorRoute);

  const editorTabs = useEditorTabs(selectedConnectionId);

  // Validate connection ID and redirect if invalid
  useEffect(() => {
    if (!connections || connections.length === 0 || !isConnectionScopedRoute) return;

    const isValidConnection = connectionIdFromUrl && connections.some(c => c.id === connectionIdFromUrl);

    // Reset the once-per-invalid guard whenever we land on a valid connection,
    // so a later invalid connectionId (on any scoped route) surfaces its toast.
    if (isValidConnection) {
      hasShownInvalidToast.current = false;
      return;
    }

    if (!connectionIdFromUrl) {
      navigate(`${location.pathname}?connectionId=${connections[0].id}`, { replace: true });
    } else {
      if (!hasShownInvalidToast.current) {
        hasShownInvalidToast.current = true;
        toastManager.add({
          title: 'Connection not found',
          description: `Connection "${connectionIdFromUrl}" does not exist`,
          type: 'error',
        });
      }
      navigate(`${location.pathname}?connectionId=${connections[0].id}`, { replace: true });
    }
  }, [connections, connectionIdFromUrl, isConnectionScopedRoute, location.pathname, navigate]);

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
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-white">
        {!isSignInRoute && demo && <DemoBanner />}
        {!isSignInRoute && banner?.text && (
          <Banner text={banner.text} link={banner.link} color={banner.color} />
        )}
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
                  isSchemasRefetching={navigation.isSchemasRefetching}
                  isTablesRefetching={navigation.isTablesRefetching}
                  schemasError={navigation.schemasError}
                  tablesError={navigation.tablesError}
                />
              } />
            <Route path="/audit-log" element={
              <AuditLog connectionId={selectedConnectionId} />
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
