'use client';

import { useState, useRef } from 'react';
import { validateImageFile } from '@/lib/utils';
import { MAX_FILE_SIZE, ACCEPTED_IMAGE_TYPES, ACCEPTED_IMAGE_EXTENSIONS } from '@/lib/constants';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
  error?: string;
}

export function FileUpload({ onFileSelect, disabled = false, error }: FileUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [validationError, setValidationError] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate
    const validation = validateImageFile(file, MAX_FILE_SIZE, ACCEPTED_IMAGE_TYPES);
    if (!validation.valid) {
      setValidationError(validation.error || 'Invalid file');
      setPreview(null);
      setFileName('');
      return;
    }

    setValidationError('');
    setFileName(file.name);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    onFileSelect(file);
  };

  const handleRemove = () => {
    setPreview(null);
    setFileName('');
    setValidationError('');
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-3">
      {/* Upload area */}
      {!preview ? (
        <label
          className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
            disabled
              ? 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 cursor-not-allowed'
              : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 bg-gray-50 dark:bg-gray-800/50 hover:bg-blue-50 dark:hover:bg-blue-900/10'
          }`}
        >
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <svg className="w-10 h-10 mb-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="mb-1 text-sm font-medium text-gray-600 dark:text-gray-300">
              Click to upload or take a photo
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              JPG, PNG, or WebP (max 5MB)
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept={ACCEPTED_IMAGE_EXTENSIONS}
            capture="environment"
            onChange={handleFileChange}
            disabled={disabled}
          />
        </label>
      ) : (
        /* Preview */
        <div className="relative">
          <img
            src={preview}
            alt="Preview"
            className="w-full h-48 object-cover rounded-xl border border-gray-200 dark:border-gray-700"
          />
          <button
            onClick={handleRemove}
            disabled={disabled}
            className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-md">
            {fileName}
          </div>
        </div>
      )}

      {/* Errors */}
      {(validationError || error) && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {validationError || error}
        </p>
      )}
    </div>
  );
}
