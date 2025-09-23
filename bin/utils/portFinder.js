const { execSync } = require('child_process');
const net = require('net');

/**
 * Find an available port within a given range
 * @param {number} startPort - Starting port number (default: 7000)
 * @param {number} endPort - Ending port number (default: 9500)
 * @returns {Promise<number|null>} - Available port number or null if none found
 */
async function findAvailablePort(startPort = 7000, endPort = 9500) {
    // Validate input parameters
    if (!Number.isInteger(startPort) || !Number.isInteger(endPort) || startPort > endPort) {
        throw new Error('Invalid port range. Ensure both start and end are numbers, and start is less than or equal to end.');
    }

    // Get list of currently used ports by Atom processes
    let usedPorts = [];
    let avoidPorts = [];

    try {
        // Try to get ports used by Atom processes
        const netstatOutput = execSync('netstat -lntp 2>/dev/null | grep "Atom" || true', { encoding: 'utf8' });

        if (netstatOutput) {
            usedPorts = netstatOutput
                .split('\n')
                .filter(line => line.trim())
                .map(line => {
                    const match = line.match(/:(\d+)\s/);
                    return match ? parseInt(match[1]) : null;
                })
                .filter(port => port !== null);

            // Create buffer zones around used Atom ports
            usedPorts.forEach(port => {
                avoidPorts.push(port - 1, port, port + 1);
            });
        }
    } catch (error) {
        // If netstat fails, continue without Atom-specific port checking
        console.log('Note: Could not check for Atom-specific ports, proceeding with general port checking.');
    }

    // Check each port in the range
    for (let port = startPort; port <= endPort; port++) {
        // Skip ports that are in the avoid list (Atom ports and their buffers)
        if (avoidPorts.includes(port)) {
            continue;
        }

        // Check if port is available
        const isAvailable = await checkPortAvailability(port);

        if (isAvailable) {
            return port;
        }
    }

    return null; // No available port found
}

/**
 * Check if a specific port is available
 * @param {number} port - Port number to check
 * @returns {Promise<boolean>} - True if port is available, false otherwise
 */
function checkPortAvailability(port) {
    return new Promise((resolve) => {
        const server = net.createServer();

        server.listen(port, '127.0.0.1', () => {
            server.close(() => {
                resolve(true);
            });
        });

        server.on('error', () => {
            resolve(false);
        });
    });
}

/**
 * Get a suggested port with user-friendly messaging
 * @param {number} startPort - Starting port number (default: 7000)
 * @param {number} endPort - Ending port number (default: 9500)
 * @returns {Promise<{port: number|null, message: string}>} - Result object with port and message
 */
async function getSuggestedPort(startPort = 7000, endPort = 9500) {
    try {
        const port = await findAvailablePort(startPort, endPort);

        if (port) {
            return {
                port: port,
                message: `Suggested available port: ${port}`
            };
        } else {
            return {
                port: null,
                message: `No available ports found in range ${startPort}-${endPort}`
            };
        }
    } catch (error) {
        return {
            port: null,
            message: `Error finding available port: ${error.message}`
        };
    }
}

module.exports = {
    findAvailablePort,
    checkPortAvailability,
    getSuggestedPort
};
