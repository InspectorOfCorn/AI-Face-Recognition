import React, { useState, useEffect } from 'react';

const App = () => {
    const [isUserDetected, setIsUserDetected] = useState(false);
    const [isKnownUser, setIsKnownUser] = useState(true);
    const [showRegistration, setShowRegistration] = useState(false);
    const [registrationData, setRegistrationData] = useState({ id: '', name: '' });
    const [recognizedName, setRecognizedName] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                // Check user presence
                const statusRes = await fetch('http://127.0.0.1:5000/user_status');
                const statusData = await statusRes.json();
                setIsUserDetected(statusData.user_detected);
                setError(null);

                // If user detected, check if known
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

        return () => clearInterval(interval);
    }, []);

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
                {error && <div className="error-message">Error: {error}</div>}
                {recognizedName && (
                    <div className="name-tag">
                        <h3>{recognizedName}</h3>
                    </div>
                )}
            </div>
            <div className="status">
                {isUserDetected ? <h2>User Detected</h2> : <h2>No User Detected</h2>}
            </div>
            
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
