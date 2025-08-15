const AtomNucleus = require("atom").Nucleus;

AtomNucleus.on('ready', async () => {
  console.log('DEBUG: Nucleus ready event received');
  try {
    const keys = await AtomNucleus.getAllAdvertisedInterfaces('Atom.Interface:::*', 2);
    console.log('Found keys:', keys);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
});

AtomNucleus.on('error', (err) => {
  console.error('Nucleus connection error:', err);
  process.exit(1);
});

// If already ready (possible in some cases)
if (AtomNucleus.readystate === AtomNucleus.READYSTATES.READY) {
  (async () => {
    try {
      const keys = await AtomNucleus.getAllAdvertisedInterfaces('Atom.Interface:::*', 2);
      console.log('Found keys:', keys);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      process.exit(0);
    }
  })();
}
