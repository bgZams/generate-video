let lastLogCount = 0;

window.initAiConsole = function() {
    const logConsole = document.getElementById('log-console');
    const logStatus = document.getElementById('log-status');
    const terminalInput = document.getElementById('terminal-input');
    const btnSendCommand = document.getElementById('btn-send-command');

    function addToTerminal(msg, type = 'info') {
        if (!logConsole) return;
        const div = document.createElement('div');
        div.style.marginBottom = '6px';
        div.style.paddingLeft = '10px';

        const colors = {
            info: '#e0e7ff',
            success: '#10b981',
            error: '#fca5a5',
            ai: '#a5b4fc',
            user: '#6366f1'
        };

        if (type === 'user') {
            div.innerHTML = `<span style="color: ${colors.user}; font-weight: bold;">YOU > </span> ${msg}`;
        } else if (type === 'ai') {
            div.innerHTML = `<span style="color: ${colors.ai}; font-weight: bold;">YOU > </span> ${msg}`;
        } else {
            div.style.borderLeft = `2px solid ${colors[type] || colors.info}`;
            div.textContent = msg;
        }

        logConsole.appendChild(div);
        logConsole.scrollTop = logConsole.scrollHeight;
    }

    async function pollLogs() {
        if (!logConsole) return;
        try {
            const response = await fetch('/api/logs');
            const data = await response.json();

            if (data.logs && data.logs.length !== lastLogCount) {
                if (data.logs.length < lastLogCount) logConsole.innerHTML = '';

                const newLogs = data.logs.slice(lastLogCount);
                newLogs.forEach(log => {
                    const div = document.createElement('div');
                    div.style.marginBottom = '4px';
                    div.style.borderLeft = `3px solid ${log.type === 'error' ? '#ef4444' : log.type === 'warn' ? '#f59e0b' : '#10b981'}`;
                    div.style.paddingLeft = '8px';

                    const timeSpan = document.createElement('span');
                    timeSpan.style.opacity = '0.5';
                    timeSpan.style.marginRight = '8px';
                    timeSpan.textContent = log.timestamp;

                    const msgSpan = document.createElement('span');
                    msgSpan.style.color = log.type === 'error' ? '#fca5a5' : log.type === 'warn' ? '#fde68a' : '#e0e7ff';
                    msgSpan.textContent = log.message;

                    div.appendChild(timeSpan);
                    div.appendChild(msgSpan);
                    logConsole.appendChild(div);
                });

                lastLogCount = data.logs.length;
                logConsole.scrollTop = logConsole.scrollHeight;
            }
            if (logStatus) {
                logStatus.textContent = 'Live Connected';
                logStatus.style.color = '#10b981';
            }
        } catch (error) {
            if (logStatus) {
                logStatus.textContent = 'Log Stream Error';
                logStatus.style.color = '#ef4444';
            }
        }
    }

    async function handleMasterCommand() {
        const cmd = terminalInput ? terminalInput.value.trim() : '';
        if (!cmd) return;

        addToTerminal(cmd, 'user');
        if (terminalInput) terminalInput.value = '';
        if (terminalInput) terminalInput.disabled = true;
        if (btnSendCommand) btnSendCommand.disabled = true;

        addToTerminal('Claude is connecting from local terminal...', 'ai');

        try {
            const response = await fetch('/api/master/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command: cmd })
            });

            const data = await response.json();
            if (!data.success) throw new Error(data.error);

            const requestId = data.requestId;

            const pollInterval = setInterval(async () => {
                const res = await fetch(`/api/master/response/${requestId}`);
                const statusData = await res.json();

                if (statusData.status === 'completed') {
                    clearInterval(pollInterval);
                    addToTerminal(statusData.response || 'Perintah selesai dieksekusi!', 'ai');
                    if (statusData.actionLogs) {
                        statusData.actionLogs.forEach(log => addToTerminal(`→ ${log}`, 'info'));
                    }
                    if (terminalInput) terminalInput.disabled = false;
                    if (btnSendCommand) btnSendCommand.disabled = false;
                    if (terminalInput) terminalInput.focus();
                }
            }, 2000);

        } catch (error) {
            addToTerminal('Error: ' + error.message, 'error');
            if (terminalInput) terminalInput.disabled = false;
            if (btnSendCommand) btnSendCommand.disabled = false;
        }
    }

    // Start polling every 2 seconds
    const intervalId = setInterval(pollLogs, 2000);
    pollLogs();

    if (btnSendCommand) btnSendCommand.addEventListener('click', handleMasterCommand);
    if (terminalInput) {
        terminalInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleMasterCommand();
        });
    }

    // Clean up interval when component reloads (optional but safe)
    window.currentConsoleInterval = intervalId;
};
