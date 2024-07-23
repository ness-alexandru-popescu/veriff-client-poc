import { createVeriffFrame, MESSAGES } from '@veriff/incontext-sdk';
import './App.css';
import { useState } from 'react';

const repositionIframe = () => {
    const interval = setInterval(() => {
        const iframe = document.querySelector('iframe');

        if (!iframe) return;
        const newParent = document.getElementById('iframe-container');
        if (!newParent) return;

        clearInterval(interval);

        // set width 100% to iframe and parent container
        iframe.style.width = '100%';
        iframe.parentElement!.style.width = '100%';
        // set height 100% to iframe and parent container
        iframe.style.height = '100%';
        iframe.parentElement!.style.height = '100%';
        iframe.parentElement!.style.position = 'relative';

        iframe.style.position = 'relative';

        // move iframe to the container
        newParent.appendChild(iframe.parentElement!);
    }, 50);
};

type StorageItems = {
    token: string;
};

const storage = {
    get: (): StorageItems => {
        const items = localStorage.getItem('veriff-poc');
        if (!items)
            return {
                token: '',
            };

        return JSON.parse(items) as StorageItems;
    },
    set: (items: StorageItems) => {
        localStorage.setItem('veriff-poc', JSON.stringify(items));
    },
};

function App() {
    const [token, setToken] = useState(storage.get().token);
    const [sessionId, setSessionId] = useState('');
    const [done, setDone] = useState(false);
    const [cancelled, setCancelled] = useState(false);

    const [loading, setLoading] = useState(false);

    const onStart = async () => {
        setLoading(true);
        const createSessionRes = await fetch('http://localhost:8000/api/session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
        }).then((res) => res.json());

        storage.set({
            token,
        });

        console.log('Create Session Response:', createSessionRes);
        setSessionId(createSessionRes.sessionId);
        setLoading(false);

        createVeriffFrame({
            url: createSessionRes.url,
            onEvent: (event) => {
                console.log('Event:', event);

                if (event === MESSAGES.FINISHED) {
                    setDone(true);
                } else if (event === MESSAGES.CANCELED) {
                    setCancelled(true);
                }
            },
        });

        repositionIframe();
    };

    const canProceed = !!token?.trim();

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100vh',
                gap: '40px',
            }}
        >
            <h1>Veriff Client Integration POC</h1>
            {loading && <div>Loading...</div>}
            {!sessionId && (
                <>
                    <LabelInput label="Token" value={token} onChange={(e) => setToken(e.target.value)} />

                    <button disabled={!canProceed} onClick={onStart}>
                        Start Veriff
                    </button>
                </>
            )}

            {sessionId && (
                <div
                    id="iframe-container"
                    style={{
                        width: '100%',
                        height: '500px',
                        border: '1px solid black',
                        borderRadius: '10px',
                    }}
                ></div>
            )}

            {cancelled && <div>Session Cancelled</div>}

            {done && <ViewDecision sessionId={sessionId} token={token} />}
            {done && <Report sessionId={sessionId} token={token} />}
        </div>
    );
}

const Report: React.FC<{
    sessionId: string;
    token: string;
}> = ({ sessionId, token }) => {
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);

    const generateReport = () => {
        setLoading(true);
        fetch(`http://localhost:8000/api/session/${sessionId}/report`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        })
            .then(async (res) => {
                if (!res.ok || res.status === 202) {
                    setError('Failed to generate report.' + (await res.text()));
                    return;
                }

                return res.blob();
            })
            .then((blob) => {
                if (!blob) return;
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'report.pdf';
                a.click();
            })
            .finally(() => {
                setDone(true);
                setLoading(false);
            });
    };

    return (
        <div>
            {!loading && !error && !done && <button onClick={generateReport}>Generate Report</button>}
            {loading && <div>Generating report...</div>}
            {error && <div style={{ color: 'red' }}>{error}</div>}
            {done && <div>Report generated successfully.</div>}
        </div>
    );
};

const ViewDecision: React.FC<{
    sessionId: string;
    token: string;
}> = ({ sessionId, token }) => {
    const [details, setDetails] = useState(null);
    const [loading, setLoading] = useState(false);
    const [show, setShow] = useState(false);

    const fetchDetails = () => {
        setShow(false);
        setLoading(true);
        fetch(`http://localhost:8000/api/session/${sessionId}/decision`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        })
            .then((res) => res.json())
            .then((res) => {
                console.log('Decision:', res);
                setDetails(res);
            });
        setLoading(false);
    };

    return (
        <div>
            {!show && <button onClick={fetchDetails}>View Decision</button>}
            {loading && <div>Loading decision...</div>}
            {!loading && details && (
                <div>
                    <h2>Decision Details</h2>
                    <pre>{JSON.stringify(details, null, 2)}</pre>
                </div>
            )}
        </div>
    );
};

const LabelInput: React.FC<{
    label: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}> = ({ label, value, onChange }) => {
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'row',
                gap: '10px',
                alignContent: 'center',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <div
                style={{
                    width: '110px',
                }}
            >
                <label htmlFor={label}>{label}</label>
            </div>
            <input id={label} type="text" value={value} onChange={onChange} />
        </div>
    );
};

export default App;
