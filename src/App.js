import React, { useState, useEffect } from 'react';
import './App.css';

/**
 * Main App component for face detection and user registration
 * Handles real-time face detection, user recognition, and new user registration
 */
const App = () => {
    // State management for user detection and recognition
    const [isUserDetected, setIsUserDetected] = useState(false);
    const [isKnownUser, setIsKnownUser] = useState(true);
    const [showRegistration, setShowRegistration] = useState(false);
    const [registrationData, setRegistrationData] = useState({ id: '', name: '' });
    const [recognizedName, setRecognizedName] = useState(null);
    const [error, setError] = useState(null);

    // Poll backend for user detection and recognition status
    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                // Check if any face is currently detected
                const statusRes = await fetch('http://127.0.0.1:5000/user_status');
                const statusData = await statusRes.json();
                setIsUserDetected(statusData.user_detected);
                setError(null);

                // If face detected, check against registered users
                if (statusData.user_detected) {
                    const checkRes = await fetch('http://127.0.0.1:5000/check_user');
                    const checkData = await checkRes.json();
                    setIsKnownUser(checkData.known_user);
                    setRecognizedName(checkData.name);
                    
                    // Only show registration if user is not known
                    if (!checkData.known_user) {
                        setShowRegistration(true);
                    } else {
                        setShowRegistration(false);
                    }
                } else {
                    // Reset states when no user is detected
                    setShowRegistration(false);
                    setRecognizedName(null);
                }
            } catch (error) {
                console.error("Error:", error);
                setError(error.message);
            }
        }, 1000);

        // Cleanup interval on component unmount
        return () => clearInterval(interval);
    }, []);

    /**
     * Handle new user registration form submission
     * Sends user data to backend for processing and storage
     * @param {Event} e - Form submission event
     */
    const handleRegistration = async (e) => {
        e.preventDefault();
        try {
            const response = await fetch('http://127.0.0.1:5000/register_user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(registrationData),
            });
            if (response.ok) {
                setShowRegistration(false);
                setIsKnownUser(true);
            } else {
                const errorData = await response.json();
                console.error("Error registering user:", errorData.error);
            }
        } catch (error) {
            console.error("Error registering user:", error);
        }
    };

    return (
        <div className="App">
            <h1>Face Detection</h1>
            {/* Camera feed display with error handling */}
            <div className="camera-widget">
                <img
                    src="http://127.0.0.1:5000/video_feed"
                    alt="Camera Feed"
                    style={{ 
                        width: '640px', 
                        height: '480px',
                        border: '2px solid #ccc',
                        borderRadius: '8px'
                    }}
                    onError={(e) => {
                        console.error("Video feed error:", e);
                        setError("Video feed unavailable");
                    }}
                />
                {/* Error and user name display */}
                {error && <div className="error-message">Error: {error}</div>}
                {recognizedName && (
                    <div className="name-tag">
                        <h3>{recognizedName}</h3>
                    </div>
                )}
            </div>

            {/* User detection status */}
            <div className="status">
                {isUserDetected ? <h2>User Detected</h2> : <h2>No User Detected</h2>}
            </div>
            
            {/* Registration form for new users */}
            {showRegistration && (
                <div className="registration-form">
                    <h3>New User Registration</h3>
                    <form onSubmit={handleRegistration}>
                        <input
                            type="text"
                            placeholder="Enter ID"
                            value={registrationData.id}
                            onChange={(e) => setRegistrationData({...registrationData, id: e.target.value})}
                        />
                        <input
                            type="text"
                            placeholder="Enter Name"
                            value={registrationData.name}
                            onChange={(e) => setRegistrationData({...registrationData, name: e.target.value})}
                        />
                        <button type="submit">Register</button>
                    </form>
                </div>
            )}
        </div>
    );
};

export default App;
