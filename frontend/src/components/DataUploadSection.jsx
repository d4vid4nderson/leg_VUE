import React, { useState, useRef } from 'react';
import {
    Upload,
    File,
    CheckCircle,
    AlertCircle,
    RotateCw,
    Database,
    FileText,
    Hash,
    ChevronDown,
    Info,
    X
} from 'lucide-react';

import API_URL from '../config/api';

const DataUploadSection = ({ isDarkMode = false }) => {
    const [uploadStatus, setUploadStatus] = useState({
        uploading: false,
        message: '',
        success: false,
        jobId: null,
        progress: 0,
        details: null
    });
    
    // Enhanced progress tracking
    const [progressDetails, setProgressDetails] = useState({
        total: 0,
        discovered_files: 0,
        processed: 0,
        successful: 0,
        failed: 0,
        ai_processed: 0,
        ai_failed: 0,
        database_saved: 0,
        database_failed: 0,
        current_stage: '',
        current_item: '',
        processing_rate: 0,
        eta_minutes: null,
        elapsed_minutes: 0,
        errors: []
    });
    
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploadType, setUploadType] = useState('state_legislation');
    const [selectedState, setSelectedState] = useState('TX');
    const [withAI, setWithAI] = useState(true);
    const [showDetails, setShowDetails] = useState(false);
    
    const fileInputRef = useRef(null);
    const pollInterval = useRef(null);

    const supportedStates = [
        { code: 'TX', name: 'Texas' },
        { code: 'CA', name: 'California' },
        { code: 'CO', name: 'Colorado' },
        { code: 'KY', name: 'Kentucky' },
        { code: 'NV', name: 'Nevada' },
        { code: 'SC', name: 'South Carolina' }
    ];

    const handleFileSelect = (event) => {
        const file = event.target.files[0];
        if (file) {
            // Validate file type
            if (file.name.endsWith('.json') || file.name.endsWith('.hash.md5') || file.name.endsWith('.md5')) {
                setSelectedFile(file);
                setUploadStatus({ uploading: false, message: '', success: false, jobId: null, progress: 0, details: null });
            } else {
                alert('Please select a .json or .hash.md5 file');
                event.target.value = '';
            }
        }
    };

    const pollJobStatus = (jobId) => {
        pollInterval.current = setInterval(async () => {
            try {
                const response = await fetch(`${API_URL}/api/admin/upload-status/${jobId}`);
                const data = await response.json();
                
                if (data.success) {
                    setUploadStatus(prev => ({
                        ...prev,
                        progress: data.progress || 0,
                        message: data.message || 'Processing...',
                        details: {
                            status: data.status,
                            total: data.total || 0,
                            processed: data.processed || 0,
                            successful: data.successful || 0,
                            failed: data.failed || 0,
                            ai_processed: data.ai_processed || 0,
                            errors: data.errors || []
                        }
                    }));
                    
                    // Update enhanced progress details
                    setProgressDetails({
                        total: data.total || 0,
                        discovered_files: data.discovered_files || 0,
                        processed: data.processed || 0,
                        successful: data.successful || 0,
                        failed: data.failed || 0,
                        ai_processed: data.ai_processed || 0,
                        ai_failed: data.ai_failed || 0,
                        database_saved: data.database_saved || 0,
                        database_failed: data.database_failed || 0,
                        current_stage: data.current_stage || '',
                        current_item: data.current_item || '',
                        processing_rate: data.processing_rate || 0,
                        eta_minutes: data.eta_minutes || null,
                        elapsed_minutes: data.elapsed_minutes || 0,
                        errors: data.errors || []
                    });
                    
                    if (data.status === 'completed' || data.status === 'failed') {
                        clearInterval(pollInterval.current);
                        setUploadStatus(prev => ({
                            ...prev,
                            uploading: false,
                            success: data.status === 'completed'
                        }));
                    }
                }
            } catch (error) {
                console.error('Error polling job status:', error);
                clearInterval(pollInterval.current);
                setUploadStatus(prev => ({
                    ...prev,
                    uploading: false,
                    success: false,
                    message: 'Error checking upload status'
                }));
            }
        }, 1000);  // Poll every 1 second for real-time updates
    };

    const handleUpload = async () => {
        if (!selectedFile) {
            alert('Please select a file first');
            return;
        }

        if (uploadType === 'state_legislation' && !selectedState) {
            alert('Please select a state for state legislation');
            return;
        }

        setUploadStatus({
            uploading: true,
            message: 'Starting upload...',
            success: false,
            jobId: null,
            progress: 0,
            details: null
        });

        try {
            const formData = new FormData();
            formData.append('file', selectedFile);
            formData.append('upload_type', uploadType);
            if (uploadType === 'state_legislation') {
                formData.append('state', selectedState);
            }
            formData.append('with_ai', withAI.toString());
            formData.append('batch_size', '15');

            const response = await fetch(`${API_URL}/api/admin/upload-data`, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                setUploadStatus(prev => ({
                    ...prev,
                    jobId: data.job_id,
                    message: data.message
                }));
                
                // Start polling for status
                pollJobStatus(data.job_id);
            } else {
                setUploadStatus({
                    uploading: false,
                    message: data.detail || 'Upload failed',
                    success: false,
                    jobId: null,
                    progress: 0,
                    details: null
                });
            }
        } catch (error) {
            console.error('Upload error:', error);
            setUploadStatus({
                uploading: false,
                message: 'Upload failed: ' + error.message,
                success: false,
                jobId: null,
                progress: 0,
                details: null
            });
        }
    };

    const clearFile = () => {
        setSelectedFile(null);
        setUploadStatus({ uploading: false, message: '', success: false, jobId: null, progress: 0, details: null });
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        if (pollInterval.current) {
            clearInterval(pollInterval.current);
        }
    };

    return (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-md p-4 mb-4">
            <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-2">
                <Upload size={16} />
                <span>Data Upload & Processing</span>
            </h4>
            
            <p className="text-blue-700 dark:text-blue-300 text-sm mb-2">
                Upload JSON or MD5 hash files to add data to the database with AI processing.
            </p>
            
            <p className="text-xs text-blue-600 dark:text-blue-400 mb-4 italic">
                Supports .json and .hash.md5 file formats. Data will be processed with AI analysis and categorization.
            </p>

            {/* Upload Type Selection */}
            <div className="space-y-3 mb-4">
                <div>
                    <label className="block text-sm font-medium text-blue-800 dark:text-blue-300 mb-1">
                        Data Type
                    </label>
                    <select
                        value={uploadType}
                        onChange={(e) => setUploadType(e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-dark-bg-secondary border border-blue-300 dark:border-blue-600 text-gray-800 dark:text-gray-200 rounded-lg"
                    >
                        <option value="state_legislation">State Legislation</option>
                        <option value="executive_orders">Executive Orders</option>
                    </select>
                </div>

                {/* State Selection (only for state legislation) */}
                {uploadType === 'state_legislation' && (
                    <div>
                        <label className="block text-sm font-medium text-blue-800 dark:text-blue-300 mb-1">
                            State
                        </label>
                        <select
                            value={selectedState}
                            onChange={(e) => setSelectedState(e.target.value)}
                            className="w-full px-3 py-2 bg-white dark:bg-dark-bg-secondary border border-blue-300 dark:border-blue-600 text-gray-800 dark:text-gray-200 rounded-lg"
                        >
                            {supportedStates.map(state => (
                                <option key={state.code} value={state.code}>
                                    {state.name} ({state.code})
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {/* AI Processing Option */}
                <div className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        id="with-ai"
                        checked={withAI}
                        onChange={(e) => setWithAI(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded"
                    />
                    <label htmlFor="with-ai" className="text-sm text-blue-700 dark:text-blue-300">
                        Process with AI analysis (recommended)
                    </label>
                </div>
            </div>

            {/* File Selection */}
            <div className="space-y-3">
                <div>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        accept=".json,.hash.md5,.md5"
                        className="hidden"
                    />
                    
                    {!selectedFile ? (
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-blue-300 dark:border-blue-600 rounded-lg hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
                        >
                            <File size={18} className="text-blue-600 dark:text-blue-400" />
                            <span className="text-blue-700 dark:text-blue-300">
                                Click to select .json or .hash.md5 file
                            </span>
                        </button>
                    ) : (
                        <div className="flex items-center justify-between p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                            <div className="flex items-center gap-2">
                                {selectedFile.name.endsWith('.json') ? (
                                    <FileText size={16} className="text-blue-600 dark:text-blue-400" />
                                ) : (
                                    <Hash size={16} className="text-blue-600 dark:text-blue-400" />
                                )}
                                <span className="text-sm text-blue-800 dark:text-blue-200">
                                    {selectedFile.name}
                                </span>
                                <span className="text-xs text-blue-600 dark:text-blue-400">
                                    ({(selectedFile.size / 1024).toFixed(1)}KB)
                                </span>
                            </div>
                            <button
                                onClick={clearFile}
                                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    )}
                </div>

                {/* Upload Button */}
                <button
                    onClick={handleUpload}
                    disabled={!selectedFile || uploadStatus.uploading}
                    className={`w-full px-4 py-2 rounded-md text-sm font-medium transition-all duration-300 min-h-[44px] flex items-center justify-center ${
                        !selectedFile || uploadStatus.uploading
                            ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                            : 'bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-400'
                    }`}
                >
                    {uploadStatus.uploading ? (
                        <>
                            <RotateCw size={14} className="animate-spin mr-2" />
                            Processing...
                        </>
                    ) : (
                        <>
                            <Database size={14} className="mr-2" />
                            Upload & Process
                        </>
                    )}
                </button>
            </div>

            {/* Status Display */}
            {(uploadStatus.message || uploadStatus.details) && (
                <div className={`mt-3 p-3 rounded-md text-sm ${
                    uploadStatus.success 
                        ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 text-green-700 dark:text-green-300'
                        : uploadStatus.uploading
                        ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                        : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300'
                }`}>
                    <div className="flex items-center justify-between">
                        <span>{uploadStatus.message}</span>
                        {uploadStatus.progress > 0 && (
                            <span className="text-xs font-mono">{uploadStatus.progress}%</span>
                        )}
                    </div>
                    
                    {/* Enhanced Progress Bar */}
                    {uploadStatus.uploading && (
                        <div className="mt-3 space-y-3">
                            {/* Main Progress Bar */}
                            <div className="w-full">
                                <div className="flex justify-between text-xs mb-1">
                                    <span>Overall Progress</span>
                                    <span>{uploadStatus.progress}%</span>
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                                    <div 
                                        className="bg-blue-600 dark:bg-blue-500 h-3 rounded-full transition-all duration-500"
                                        style={{ width: `${uploadStatus.progress}%` }}
                                    ></div>
                                </div>
                            </div>

                            {/* Current Stage & Item */}
                            {progressDetails.current_stage && (
                                <div className="text-xs space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium capitalize">{progressDetails.current_stage}:</span>
                                        {progressDetails.current_stage === 'discovering' && (
                                            <RotateCw size={12} className="animate-spin text-blue-500" />
                                        )}
                                        {progressDetails.current_stage === 'extracting' && (
                                            <Database size={12} className="text-green-500" />
                                        )}
                                        {progressDetails.current_stage === 'ready' && (
                                            <CheckCircle size={12} className="text-blue-500" />
                                        )}
                                    </div>
                                    {progressDetails.current_item && (
                                        <div className="text-gray-600 dark:text-gray-400 truncate">
                                            {progressDetails.current_item}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Progress Stats Grid */}
                            {progressDetails.total > 0 && (
                                <div className="grid grid-cols-2 gap-3 text-xs">
                                    {/* File Discovery */}
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-1">
                                            <File size={12} className="text-blue-500" />
                                            <span className="font-medium">Discovery</span>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex justify-between">
                                                <span>Files Found:</span>
                                                <span className="font-mono">{progressDetails.discovered_files.toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Processing:</span>
                                                <span className="font-mono">{progressDetails.total.toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* AI Processing */}
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-1">
                                            <Hash size={12} className="text-purple-500" />
                                            <span className="font-medium">AI Analysis</span>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex justify-between">
                                                <span>Processed:</span>
                                                <span className="font-mono text-green-600">{progressDetails.ai_processed.toLocaleString()}</span>
                                            </div>
                                            {progressDetails.ai_failed > 0 && (
                                                <div className="flex justify-between">
                                                    <span>Failed:</span>
                                                    <span className="font-mono text-red-600">{progressDetails.ai_failed.toLocaleString()}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Database Operations */}
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-1">
                                            <Database size={12} className="text-green-500" />
                                            <span className="font-medium">Database</span>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex justify-between">
                                                <span>Saved:</span>
                                                <span className="font-mono text-green-600">{progressDetails.database_saved.toLocaleString()}</span>
                                            </div>
                                            {progressDetails.database_failed > 0 && (
                                                <div className="flex justify-between">
                                                    <span>Failed:</span>
                                                    <span className="font-mono text-red-600">{progressDetails.database_failed.toLocaleString()}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Performance Stats */}
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-1">
                                            <RotateCw size={12} className="text-orange-500" />
                                            <span className="font-medium">Performance</span>
                                        </div>
                                        <div className="space-y-1">
                                            {progressDetails.processing_rate > 0 && (
                                                <div className="flex justify-between">
                                                    <span>Rate:</span>
                                                    <span className="font-mono">{progressDetails.processing_rate}/min</span>
                                                </div>
                                            )}
                                            {progressDetails.eta_minutes && (
                                                <div className="flex justify-between">
                                                    <span>ETA:</span>
                                                    <span className="font-mono">{progressDetails.eta_minutes}m</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between">
                                                <span>Elapsed:</span>
                                                <span className="font-mono">{progressDetails.elapsed_minutes}m</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Recent Errors */}
                            {progressDetails.errors.length > 0 && (
                                <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
                                    <div className="flex items-center gap-1 mb-2">
                                        <AlertCircle size={12} className="text-red-500" />
                                        <span className="text-xs font-medium text-red-700 dark:text-red-300">Recent Issues</span>
                                    </div>
                                    <div className="space-y-1 max-h-20 overflow-y-auto">
                                        {progressDetails.errors.slice(-3).map((error, index) => (
                                            <div key={index} className="text-xs text-red-600 dark:text-red-400 truncate">
                                                {error}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    
                    {/* Details */}
                    {uploadStatus.details && (
                        <div className="mt-2">
                            <button
                                onClick={() => setShowDetails(!showDetails)}
                                className="flex items-center gap-1 text-xs hover:underline"
                            >
                                <ChevronDown size={12} className={showDetails ? 'rotate-180' : ''} />
                                Details
                            </button>
                            
                            {showDetails && (
                                <div className="mt-2 text-xs space-y-1">
                                    <div className="flex justify-between">
                                        <span>Status:</span>
                                        <span className={`font-medium ${
                                            uploadStatus.details.status === 'completed' ? 'text-green-600' :
                                            uploadStatus.details.status === 'failed' ? 'text-red-600' :
                                            'text-blue-600'
                                        }`}>{uploadStatus.details.status}</span>
                                    </div>
                                    {uploadStatus.details.total > 0 && (
                                        <div className="flex justify-between">
                                            <span>Progress:</span>
                                            <span>{uploadStatus.details.processed} / {uploadStatus.details.total}</span>
                                        </div>
                                    )}
                                    {uploadStatus.details.successful > 0 && (
                                        <div className="flex justify-between">
                                            <span>Successful:</span>
                                            <span className="text-green-600">{uploadStatus.details.successful}</span>
                                        </div>
                                    )}
                                    {uploadStatus.details.ai_processed > 0 && (
                                        <div className="flex justify-between">
                                            <span>AI Processed:</span>
                                            <span className="text-blue-600">{uploadStatus.details.ai_processed}</span>
                                        </div>
                                    )}
                                    {uploadStatus.details.failed > 0 && (
                                        <div className="flex justify-between">
                                            <span>Failed:</span>
                                            <span className="text-red-600">{uploadStatus.details.failed}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* File Format Help */}
            <div className="mt-4 p-3 bg-blue-100 dark:bg-blue-900/30 rounded-md">
                <div className="flex items-center gap-2 mb-2">
                    <Info size={14} className="text-blue-600 dark:text-blue-400" />
                    <span className="text-xs font-medium text-blue-800 dark:text-blue-300">
                        Supported File Formats
                    </span>
                </div>
                <div className="text-xs text-blue-700 dark:text-blue-400 space-y-1">
                    <div><strong>.json:</strong> Standard JSON format with bill/order arrays</div>
                    <div><strong>.hash.md5:</strong> Hash and filename pairs for document processing</div>
                </div>
            </div>
        </div>
    );
};

export default DataUploadSection;