import { useState, useCallback, useEffect, useMemo } from 'react';
import { Delete, Lock, ArrowLeft, HelpCircle, CheckCircle2 } from 'lucide-react';

interface PinEntryProps {
  title: string;
  subtitle?: string;
  onSubmit: (pin: string) => Promise<boolean | void>;
  onCancel?: () => void;
  onReset?: () => Promise<void>; // New prop for PIN reset
  confirmMode?: boolean;
  minLength?: number;
  maxLength?: number;
}

export function PinEntry({
  title,
  subtitle,
  onSubmit,
  onCancel,
  onReset,
  confirmMode = false,
  minLength = 4,
  maxLength = 6,
}: PinEntryProps) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryAnswer, setRecoveryAnswer] = useState('');

  // Generate a simple math challenge
  const mathChallenge = useMemo(() => {
    const a = Math.floor(Math.random() * 20) + 10;
    const b = Math.floor(Math.random() * 20) + 5;
    return { q: `${a} + ${b}`, a: a + b };
  }, [showRecovery]);

  const currentPin = isConfirming ? confirmPin : pin;
  const setCurrentPin = isConfirming ? setConfirmPin : setPin;

  const handleBack = useCallback(() => {
    if (showRecovery) {
      setShowRecovery(false);
      setRecoveryAnswer('');
      setError('');
    } else if (isConfirming) {
      setIsConfirming(false);
      setConfirmPin('');
      setError('');
    } else if (onCancel) {
      onCancel();
    }
  }, [isConfirming, onCancel, showRecovery]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleBack();
      }
    };
    window.addEventListener('keydown', handleEsc, { capture: true });
    return () => window.removeEventListener('keydown', handleEsc, { capture: true });
  }, [handleBack]);

  const handleDigit = useCallback((digit: string) => {
    setError('');
    if (currentPin.length < maxLength) {
      setCurrentPin(currentPin + digit);
    }
  }, [currentPin, maxLength, setCurrentPin]);

  const handleDelete = useCallback(() => {
    setError('');
    setCurrentPin(currentPin.slice(0, -1));
  }, [currentPin, setCurrentPin]);

  const handleClear = useCallback(() => {
    setCurrentPin('');
    setError('');
  }, [setCurrentPin]);

  const handleSubmit = useCallback(async () => {
    if (currentPin.length < minLength) {
      setError(`PIN must be at least ${minLength} digits`);
      return;
    }

    if (confirmMode && !isConfirming) {
      setIsConfirming(true);
      return;
    }

    if (confirmMode && isConfirming) {
      if (pin !== confirmPin) {
        setError('PINs do not match');
        setConfirmPin('');
        return;
      }
    }

    setIsLoading(true);
    try {
      const result = await onSubmit(confirmMode ? pin : currentPin);
      if (result === false) {
        setError('Incorrect PIN');
        setPin('');
        setConfirmPin('');
        setIsConfirming(false);
      }
    } catch {
      setError('Something went wrong');
    } finally {
      setIsLoading(false);
    }
  }, [currentPin, minLength, confirmMode, isConfirming, pin, confirmPin, onSubmit]);

  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parseInt(recoveryAnswer) === mathChallenge.a) {
      // Successful recovery - trigger PIN reset
      try {
        if (onReset) {
          await onReset();
        }
        // Clear local state regardless
        setPin('');
        setConfirmPin('');
        setIsConfirming(false);
        setShowRecovery(false);
        setRecoveryAnswer('');
        setError('');
      } catch (error) {
        setError('Failed to reset PIN. Please try again.');
      }
    } else {
      setError('Incorrect answer. Please try again.');
      setRecoveryAnswer('');
    }
  };

  const displayTitle = showRecovery ? 'Parent Verification' : isConfirming ? 'Confirm PIN' : title;
  const displaySubtitle = showRecovery
    ? 'Prove you are a parent by solving this math problem'
    : isConfirming
      ? 'Enter your PIN again to confirm'
      : subtitle;

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-100 to-sky-200 flex flex-col items-center justify-center p-4 select-none">
      <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm relative overflow-hidden">
        {/* Help icon for recovery */}
        {!confirmMode && !showRecovery && (
          <button
            onClick={() => setShowRecovery(true)}
            className="absolute top-6 right-6 p-2 text-gray-400 hover:text-sky-500 transition-colors"
            title="Forgot PIN?"
          >
            <HelpCircle className="w-6 h-6" />
          </button>
        )}

        {(onCancel || isConfirming || showRecovery) && (
          <button
            onClick={handleBack}
            className="absolute top-6 left-6 p-2 text-gray-400 hover:text-gray-700 transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
        )}

        <div className="flex flex-col items-center mb-8 mt-4">
          <div className="w-20 h-20 bg-sky-50 rounded-full flex items-center justify-center mb-4 ring-8 ring-sky-50/50">
            {showRecovery ? (
              <CheckCircle2 className="w-10 h-10 text-sky-500" />
            ) : (
              <Lock className="w-10 h-10 text-sky-600" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-800 text-center">{displayTitle}</h1>
          {displaySubtitle && (
            <p className="text-gray-500 text-center mt-2 leading-tight">{displaySubtitle}</p>
          )}
        </div>

        {showRecovery ? (
          <form onSubmit={handleRecoverySubmit} className="space-y-6">
            <div className="bg-gray-50 rounded-2xl p-6 text-center">
              <span className="text-3xl font-black text-gray-700 tracking-wider">
                {mathChallenge.q} = ?
              </span>
            </div>

            <input
              autoFocus
              type="number"
              value={recoveryAnswer}
              onChange={(e) => setRecoveryAnswer(e.target.value)}
              placeholder="Enter answer"
              className="w-full h-16 rounded-2xl bg-gray-100 border-2 border-transparent focus:border-sky-500 focus:bg-white text-center text-2xl font-bold outline-none transition-all"
            />

            {error && (
              <div className="text-red-500 text-center text-sm font-medium animate-pulse">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full h-14 rounded-2xl bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-white font-bold text-lg shadow-lg active:scale-95 transition-all"
            >
              Verify & Reset
            </button>
          </form>
        ) : (
          <>
            <div className="flex justify-center gap-3 mb-8">
              {Array.from({ length: maxLength }).map((_, i) => (
                <div
                  key={i}
                  className={`w-4 h-4 rounded-full transition-all duration-300 ${i < currentPin.length
                    ? 'bg-sky-500 scale-125 shadow-sm'
                    : 'bg-gray-200'
                    }`}
                />
              ))}
            </div>

            {error && (
              <div className="text-red-500 text-center text-sm mb-6 font-medium animate-shake">
                {error}
              </div>
            )}

            <div className="grid grid-cols-3 gap-4 mb-6">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                <button
                  key={digit}
                  onClick={() => handleDigit(digit.toString())}
                  disabled={isLoading}
                  className="h-16 rounded-2xl bg-gray-50 hover:bg-sky-50 active:bg-sky-100 transition-all text-2xl font-bold text-gray-700 disabled:opacity-50 active:scale-95 border border-transparent hover:border-sky-100"
                >
                  {digit}
                </button>
              ))}
              <button
                onClick={handleClear}
                disabled={isLoading}
                className="h-16 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-all text-sm font-bold text-gray-500 disabled:opacity-50 active:scale-95"
              >
                Clear
              </button>
              <button
                onClick={() => handleDigit('0')}
                disabled={isLoading}
                className="h-16 rounded-2xl bg-gray-50 hover:bg-sky-50 active:bg-sky-100 transition-all text-2xl font-bold text-gray-700 disabled:opacity-50 active:scale-95 border border-transparent hover:border-sky-100"
              >
                0
              </button>
              <button
                onClick={handleDelete}
                disabled={isLoading}
                className="h-16 rounded-2xl bg-gray-50 hover:bg-red-50 transition-all flex items-center justify-center disabled:opacity-50 active:scale-95"
              >
                <Delete className="w-6 h-6 text-gray-400 group-hover:text-red-400" />
              </button>
            </div>

            <button
              onClick={handleSubmit}
              disabled={currentPin.length < minLength || isLoading}
              className="w-full h-14 rounded-2xl bg-sky-500 hover:bg-sky-600 active:bg-sky-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-all text-white font-bold text-lg shadow-lg active:scale-95"
            >
              {isLoading ? 'Please wait...' : isConfirming ? 'Confirm' : confirmMode ? 'Next' : 'Enter'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
