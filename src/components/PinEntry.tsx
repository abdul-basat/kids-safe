import { useState, useCallback } from 'react';
import { Delete, Lock, ArrowLeft } from 'lucide-react';

interface PinEntryProps {
  title: string;
  subtitle?: string;
  onSubmit: (pin: string) => Promise<boolean | void>;
  onCancel?: () => void;
  confirmMode?: boolean;
  minLength?: number;
  maxLength?: number;
}

export function PinEntry({
  title,
  subtitle,
  onSubmit,
  onCancel,
  confirmMode = false,
  minLength = 4,
  maxLength = 6,
}: PinEntryProps) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const currentPin = isConfirming ? confirmPin : pin;
  const setCurrentPin = isConfirming ? setConfirmPin : setPin;

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

  const handleBack = useCallback(() => {
    if (isConfirming) {
      setIsConfirming(false);
      setConfirmPin('');
      setError('');
    } else if (onCancel) {
      onCancel();
    }
  }, [isConfirming, onCancel]);

  const displayTitle = isConfirming ? 'Confirm PIN' : title;
  const displaySubtitle = isConfirming ? 'Enter your PIN again to confirm' : subtitle;

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-100 to-sky-200 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-sm">
        {(onCancel || isConfirming) && (
          <button
            onClick={handleBack}
            className="mb-4 p-2 -ml-2 text-gray-500 hover:text-gray-700 transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
        )}

        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-sky-100 rounded-full flex items-center justify-center mb-4">
            <Lock className="w-8 h-8 text-sky-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 text-center">{displayTitle}</h1>
          {displaySubtitle && (
            <p className="text-gray-500 text-center mt-2">{displaySubtitle}</p>
          )}
        </div>

        <div className="flex justify-center gap-3 mb-6">
          {Array.from({ length: maxLength }).map((_, i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full transition-all ${
                i < currentPin.length
                  ? 'bg-sky-500 scale-110'
                  : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        {error && (
          <div className="text-red-500 text-center text-sm mb-4 animate-pulse">
            {error}
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 mb-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
            <button
              key={digit}
              onClick={() => handleDigit(digit.toString())}
              disabled={isLoading}
              className="h-16 rounded-xl bg-gray-100 hover:bg-gray-200 active:bg-gray-300 transition-colors text-2xl font-semibold text-gray-800 disabled:opacity-50"
            >
              {digit}
            </button>
          ))}
          <button
            onClick={handleClear}
            disabled={isLoading}
            className="h-16 rounded-xl bg-gray-100 hover:bg-gray-200 active:bg-gray-300 transition-colors text-sm font-medium text-gray-600 disabled:opacity-50"
          >
            Clear
          </button>
          <button
            onClick={() => handleDigit('0')}
            disabled={isLoading}
            className="h-16 rounded-xl bg-gray-100 hover:bg-gray-200 active:bg-gray-300 transition-colors text-2xl font-semibold text-gray-800 disabled:opacity-50"
          >
            0
          </button>
          <button
            onClick={handleDelete}
            disabled={isLoading}
            className="h-16 rounded-xl bg-gray-100 hover:bg-gray-200 active:bg-gray-300 transition-colors flex items-center justify-center disabled:opacity-50"
          >
            <Delete className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        <button
          onClick={handleSubmit}
          disabled={currentPin.length < minLength || isLoading}
          className="w-full h-14 rounded-xl bg-sky-500 hover:bg-sky-600 active:bg-sky-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-white font-semibold text-lg"
        >
          {isLoading ? 'Please wait...' : isConfirming ? 'Confirm' : confirmMode ? 'Next' : 'Enter'}
        </button>
      </div>
    </div>
  );
}
