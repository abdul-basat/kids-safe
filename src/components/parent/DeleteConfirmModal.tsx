import { useState, useCallback, useEffect } from 'react';
import { X, AlertTriangle, Loader2 } from 'lucide-react';

interface DeleteConfirmModalProps {
    isOpen: boolean;
    title: string;
    itemName: string;
    onConfirm: () => Promise<void>;
    onCancel: () => void;
}

function generateMathProblem(): { question: string; answer: number } {
    const a = Math.floor(Math.random() * 10) + 5; // 5-14
    const b = Math.floor(Math.random() * 10) + 1; // 1-10
    const operators = ['+', '-', '×'];
    const op = operators[Math.floor(Math.random() * operators.length)];

    let answer: number;
    switch (op) {
        case '+':
            answer = a + b;
            break;
        case '-':
            answer = a - b;
            break;
        case '×':
            answer = a * b;
            break;
        default:
            answer = a + b;
    }

    return { question: `${a} ${op} ${b} = ?`, answer };
}

export function DeleteConfirmModal({
    isOpen,
    title,
    itemName,
    onConfirm,
    onCancel
}: DeleteConfirmModalProps) {
    const [mathProblem, setMathProblem] = useState(() => generateMathProblem());
    const [userAnswer, setUserAnswer] = useState('');
    const [error, setError] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

    // Reset when modal opens
    useEffect(() => {
        if (isOpen) {
            setMathProblem(generateMathProblem());
            setUserAnswer('');
            setError('');
            setIsDeleting(false);
        }
    }, [isOpen]);

    const handleSubmit = useCallback(async () => {
        const parsed = parseInt(userAnswer, 10);
        if (isNaN(parsed)) {
            setError('Please enter a number');
            return;
        }

        if (parsed !== mathProblem.answer) {
            setError('Wrong answer. Try again!');
            setMathProblem(generateMathProblem());
            setUserAnswer('');
            return;
        }

        setIsDeleting(true);
        try {
            await onConfirm();
        } catch (err) {
            console.error('Delete failed:', err);
            setError('Failed to delete. Please try again.');
            setIsDeleting(false);
        }
    }, [userAnswer, mathProblem.answer, onConfirm]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b bg-red-50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                            <AlertTriangle className="w-5 h-5 text-red-600" />
                        </div>
                        <h2 className="text-lg font-bold text-gray-800">{title}</h2>
                    </div>
                    <button
                        onClick={onCancel}
                        disabled={isDeleting}
                        className="p-2 rounded-full hover:bg-red-100 transition-colors disabled:opacity-50"
                    >
                        <X className="w-5 h-5 text-gray-600" />
                    </button>
                </div>

                <div className="p-4">
                    <p className="text-gray-700 mb-4">
                        Are you sure you want to delete <strong className="text-red-600">"{itemName}"</strong>?
                    </p>

                    <p className="text-sm text-gray-500 mb-4">
                        This action cannot be undone.
                    </p>

                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                        <p className="text-sm text-amber-800 font-medium mb-2">
                            🧮 Solve to confirm (parental check):
                        </p>
                        <p className="text-2xl font-bold text-center text-amber-900 mb-3">
                            {mathProblem.question}
                        </p>
                        <input
                            type="number"
                            value={userAnswer}
                            onChange={(e) => {
                                setUserAnswer(e.target.value);
                                setError('');
                            }}
                            placeholder="Your answer"
                            disabled={isDeleting}
                            className="w-full px-4 py-3 border border-amber-300 rounded-xl text-center text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent disabled:bg-gray-100"
                            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                            autoFocus
                        />
                    </div>

                    {error && (
                        <p className="text-red-500 text-sm text-center mb-4">{error}</p>
                    )}
                </div>

                <div className="p-4 border-t bg-gray-50 flex gap-3">
                    <button
                        onClick={onCancel}
                        disabled={isDeleting}
                        className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-semibold transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isDeleting || !userAnswer}
                        className="flex-1 py-3 bg-red-500 hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
                    >
                        {isDeleting ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Deleting...
                            </>
                        ) : (
                            'Delete'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
