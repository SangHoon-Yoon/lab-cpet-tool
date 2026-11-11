// Where the tests find things. Sample files are participant data, so they live OUTSIDE this repository:
// wherever LABCPET_SAMPLES points, else ../lab-cpet-private/samples, else ../samples.
// Downloads made during tests go to a temporary folder (or DL).
const path = require('path'), os = require('os'), fs = require('fs');
const cand = [process.env.LABCPET_SAMPLES, path.join(__dirname, '..', '..', 'lab-cpet-private', 'samples'), path.join(__dirname, '..', '..', 'samples')].filter(Boolean);
const SAMPLES = path.resolve(cand.find(p => fs.existsSync(p)) || cand[0]) + path.sep;
if (!fs.existsSync(SAMPLES)) { console.error('Sample folder not found: ' + SAMPLES + '\nPut the sample files there, or set LABCPET_SAMPLES to their folder.'); process.exit(2); }
const SIM = path.join(__dirname, 'sim') + path.sep;
const DL = process.env.DL || fs.mkdtempSync(path.join(os.tmpdir(), 'labcpet-'));
module.exports = { SAMPLES, SIM, DL };
