import { useState, useCallback } from 'react';
import { Lock, Clock, AlertTriangle, Loader2, Check } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { updateDailyLimit } from '../../lib/api/settings';

export function SettingsPanel() {
  const { settings, changePin } = useApp();
  const [isChangingPin, setIsChangingPin] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinSuccess, setPinSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [dailyLimit, setDailyLimit] = useState(settings?.daily_limit_minutes || 0);
  const [isSavingLimit, setIsSavingLimit] = useState(false);
  const [limitSaved, setLimitSaved] = useState(false);

  const handleChangePin = useCallback(async () => {
    setPinError('');
    setPinSuccess(false);

    if (newPin.length < 4) {
      setPinError('PIN must be at least 4 digits');
      return;
    }

    if (newPin !== confirmPin) {
      setPinError('PINs do not match');
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await changePin(currentPin, newPin);
      if (success) {
        setPinSuccess(true);
        setCurrentPin('');
        setNewPin('');
        setConfirmPin('');
        setIsChangingPin(false);
        setTimeout(() => setPinSuccess(false), 3000);
      } else {
        setPinError('Current PIN is incorrect');
      }
    } catch {
      setPinError('Failed to change PIN');
    } finally {
      setIsSubmitting(false);
    }
  }, [currentPin, newPin, confirmPin, changePin]);

  const handleSaveDailyLimit = useCallback(async () => {
    if (!settings) return;

    setIsSavingLimit(true);
    try {
      await updateDailyLimit(settings.id, dailyLimit);
      setLimitSaved(true);
      setTimeout(() => setLimitSaved(false), 3000);
    } catch (err) {
      console.error('Error saving daily limit:', err);
    } finally {
      setIsSavingLimit(false);
    }
  }, [settings, dailyLimit]);

  return (
    <div className="max-w-xl space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b bg-gray-50">
          <div className="flex items-center gap-3">
            <Lock className="w-5 h-5 text-gray-600" />
            <h3 className="font-semibold text-gray-800">PIN Security</h3>
          </div>
        </div>

        <div className="p-4">
          {pinSuccess && (
            <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg flex items-center gap-2">
              <Check className="w-5 h-5" />
              PIN changed successfully!
            </div>
          )}

          {isChangingPin ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Current PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={currentPin}
                  onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                  maxLength={6}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="Enter current PIN"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                  maxLength={6}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="Enter new PIN (4-6 digits)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm New PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                  maxLength={6}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="Confirm new PIN"
                />
              </div>

              {pinError && (
                <p className="text-red-500 text-sm">{pinError}</p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setIsChangingPin(false);
                    setCurrentPin('');
                    setNewPin('');
                    setConfirmPin('');
                    setPinError('');
                  }}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleChangePin}
                  disabled={isSubmitting}
                  className="flex-1 py-3 bg-sky-500 hover:bg-sky-600 disabled:bg-gray-300 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save PIN'
                  )}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsChangingPin(true)}
              className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors"
            >
              Change PIN
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b bg-gray-50">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-gray-600" />
            <h3 className="font-semibold text-gray-800">Daily Watch Limit</h3>
          </div>
        </div>

        <div className="p-4">
          <p className="text-sm text-gray-600 mb-4">
            Set a daily time limit for watching videos. Set to 0 for unlimited.
          </p>

          {limitSaved && (
            <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg flex items-center gap-2">
              <Check className="w-5 h-5" />
              Limit saved successfully!
            </div>
          )}

          <div className="flex items-center gap-4">
            <div className="flex-1">
              <input
                type="number"
                min="0"
                max="480"
                value={dailyLimit}
                onChange={(e) => setDailyLimit(parseInt(e.target.value) || 0)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <span className="text-gray-600">minutes</span>
            <button
              onClick={handleSaveDailyLimit}
              disabled={isSavingLimit}
              className="px-6 py-3 bg-sky-500 hover:bg-sky-600 disabled:bg-gray-300 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
            >
              {isSavingLimit ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                'Save'
              )}
            </button>
          </div>

          <p className="text-xs text-gray-400 mt-2">
            {dailyLimit === 0
              ? 'No limit set'
              : `${Math.floor(dailyLimit / 60)}h ${dailyLimit % 60}m per day`}
          </p>
        </div>
      </div>

      <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-amber-800">Security Tips</h4>
            <ul className="text-sm text-amber-700 mt-2 space-y-1">
              <li>Keep your PIN private and memorable</li>
              <li>Parent mode automatically locks after 5 minutes of inactivity</li>
              <li>To access parent mode, tap the top-right corner 5 times</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
