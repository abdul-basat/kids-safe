import { AppProvider, useApp } from './context/AppContext';
import { PinEntry } from './components/PinEntry';
import { ChildViewer } from './components/ChildViewer';
import { ParentDashboard } from './components/parent';
import { Loader2 } from 'lucide-react';

function AppContent() {
  const { mode, setupPin, enterParentMode, exitParentMode } = useApp();

  if (mode === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-100 to-sky-200 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-sky-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (mode === 'setup') {
    return (
      <PinEntry
        title="Create Your PIN"
        subtitle="Set a PIN to protect parent settings"
        onSubmit={setupPin}
        confirmMode
      />
    );
  }

  if (mode === 'pin-entry') {
    return (
      <PinEntry
        title="Enter Parent PIN"
        subtitle="Enter your PIN to access settings"
        onSubmit={enterParentMode}
        onCancel={exitParentMode}
      />
    );
  }

  if (mode === 'parent') {
    return <ParentDashboard />;
  }

  return <ChildViewer />;
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
