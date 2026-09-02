/**
 * Deterministic fake test command for classifier mutation tests.
 *
 * It emits exactly the base64-decoded stdout/stderr it is given and exits with
 * the requested code, or kills itself with the requested signal. Nothing else
 * runs, so the classifier is measured against output shapes alone.
 */
const args = new Map(
  process.argv.slice(2).map((argument) => {
    const index = argument.indexOf("=");
    return [argument.slice(2, index), argument.slice(index + 1)];
  }),
);

const decode = (value) => (value ? Buffer.from(value, "base64").toString("utf8") : "");
const out = decode(args.get("stdout"));
const err = decode(args.get("stderr"));
if (out) process.stdout.write(`${out}\n`);
if (err) process.stderr.write(`${err}\n`);

const signal = args.get("signal");
if (signal) {
  process.kill(process.pid, signal);
} else {
  process.exit(Number(args.get("code") ?? 1));
}
