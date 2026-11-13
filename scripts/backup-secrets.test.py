"""Prüft den interaktiven Helfer ausschließlich mit erfundenen Schlüsseln und gh-Mock."""
import base64
import json
import os
from pathlib import Path
import pty
import select
import shutil
import subprocess
import termios
import tempfile
import time
import unittest


class SecretHelperTest(unittest.TestCase):
    def test_host_stdin_and_targeted_env_parsing(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "scripts").mkdir()
            (root / "bin").mkdir()
            for filename in ["configure-backup-secrets.sh", "backup-env.mjs"]:
                shutil.copyfile(Path(__file__).parent / filename, root / "scripts" / filename)
            payload = base64.urlsafe_b64encode(json.dumps({"role": "service_role", "ref": "jktvmckqfklfziszfsxf"}).encode()).decode().rstrip("=")
            service = "fixture." + payload + ".fixture"
            marker = root / "must-not-exist"
            (root / ".env.local").write_text(f"OTHER=$(touch {marker})\nSUPABASE_SERVICE_ROLE_KEY='{service}'\n")
            mock = root / "bin" / "gh"
            mock.write_text("""#!/usr/bin/env python3
import json, os, sys
args = sys.argv[1:]
record = {'args': args, 'host': os.environ.get('GH_HOST'), 'stdin': sys.stdin.read() if args[:2] == ['secret','set'] else None}
with open(os.environ['MOCK_RECORDS'],'a') as target: target.write(json.dumps(record) + '\\n')
if args[:2] == ['api','user']: print('BastiiSP')
elif args[:1] == ['api']: print('true')
""")
            mock.chmod(0o700)
            environment = {**os.environ, "PATH": str(root / "bin") + os.pathsep + os.environ["PATH"], "GH_HOST": "wrong.invalid", "MOCK_RECORDS": str(root / "records")}
            master, slave = pty.openpty()
            original_terminal = termios.tcgetattr(master)
            process = subprocess.Popen(["bash", str(root / "scripts" / "configure-backup-secrets.sh")], stdin=slave, stdout=slave, stderr=slave, env=environment)
            os.close(slave)
            output = bytearray()
            consumed = 0

            def answer(prompt, value=None):
                nonlocal consumed
                deadline = time.monotonic() + 15
                while prompt.encode() not in output[consumed:]:
                    if time.monotonic() > deadline:
                        self.fail("Interaktiver Test wartet unerwartet auf Eingabe.")
                    if select.select([master], [], [], 0.2)[0]:
                        try:
                            chunk = os.read(master, 4096)
                        except OSError:
                            chunk = b""
                        if not chunk:
                            self.fail("Interaktiver Test wurde vorzeitig beendet.")
                        output.extend(chunk)
                consumed = output.index(prompt.encode(), consumed) + len(prompt.encode())
                if value is not None:
                    os.write(master, value.encode() + b"\n")

            password = "fixture:db\\password"
            key = "fixture-b2-application-secret"
            restic = "fixture-restic-password-32-characters-long"
            try:
                answer("Session-Pooler-Host:", "aws-0-eu-central-1.pooler.supabase.com")
                answer("Session-Port", "")
                answer("Datenbanknutzer", "")
                answer("Bestehendes Datenbankpasswort", password)
                answer("B2-Anwendungsschlüssel-ID", "fixture-key-id")
                answer("B2-Anwendungsschlüssel,", key)
                # Beide Zeilen absichtlich sofort einfügen. Die zweite wartet
                # bereits, während der Helfer zwischen den Prompts arbeitet.
                answer("Neues restic-Passwort mit mindestens 32 Zeichen: ", restic + "\n" + restic)
                answer("restic-Passwort wiederholen: ")
                answer("Bestätigung WEITER", "WEITER")
                while process.poll() is None:
                    if select.select([master], [], [], 0.2)[0]:
                        try:
                            output.extend(os.read(master, 4096))
                        except OSError:
                            break
                self.assertEqual(process.wait(timeout=10), 0)
                self.assertEqual(termios.tcgetattr(master), original_terminal)
            finally:
                if process.poll() is None:
                    process.kill()
                    process.wait()
                os.close(master)
            records = [json.loads(line) for line in (root / "records").read_text().splitlines()]
            self.assertTrue(all(record["host"] == "github.com" for record in records))
            secrets = [record for record in records if record["args"][:2] == ["secret", "set"]]
            self.assertEqual(len(secrets), 10)
            for record in secrets:
                self.assertEqual(record["args"][3:], ["--repo", "BastiiSP/fcb-website"])
                self.assertNotIn(record["stdin"], record["args"])
            values = {record["args"][2]: record["stdin"] for record in secrets}
            self.assertEqual(values["BACKUP_DB_PASSWORD"], password)
            self.assertEqual(values["BACKUP_SUPABASE_SERVICE_ROLE_KEY"], service)
            self.assertEqual(values["BACKUP_S3_KEY"], key)
            self.assertEqual(values["BACKUP_RESTIC_PASSWORD"], restic)
            for value in [password, service, key, restic]:
                self.assertNotIn(value.encode(), output)
            self.assertFalse(marker.exists())

    def test_abort_restores_terminal_and_does_not_transfer(self):
        for signal_number in [1, 2, 15]:
            with self.subTest(signal=signal_number), tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary)
                (root / "scripts").mkdir()
                (root / "bin").mkdir()
                shutil.copyfile(Path(__file__).parent / "configure-backup-secrets.sh", root / "scripts" / "configure-backup-secrets.sh")
                mock = root / "bin" / "gh"
                mock.write_text("#!/usr/bin/env bash\nif [[ $1 == api && $2 == user ]]; then echo BastiiSP; elif [[ $1 == api ]]; then echo true; elif [[ $1 == secret ]]; then touch \"$MOCK_TRANSFER\"; fi\n")
                mock.chmod(0o700)
                environment = {**os.environ, "PATH": str(root / "bin") + os.pathsep + os.environ["PATH"], "MOCK_TRANSFER": str(root / "must-not-transfer")}
                master, slave = pty.openpty()
                original = termios.tcgetattr(master)
                process = subprocess.Popen(["bash", str(root / "scripts" / "configure-backup-secrets.sh")], stdin=slave, stdout=slave, stderr=slave, env=environment)
                os.close(slave)
                output = bytearray()
                try:
                    deadline = time.monotonic() + 10
                    while b"Session-Pooler-Host: " not in output:
                        if time.monotonic() > deadline:
                            self.fail("Abbruchtest erreichte den ersten Prompt nicht.")
                        if select.select([master], [], [], 0.2)[0]:
                            output.extend(os.read(master, 4096))
                    self.assertFalse(termios.tcgetattr(master)[3] & termios.ECHO)
                    os.write(master, b"fixture-geheime-wartende-eingabe")
                    os.kill(process.pid, signal_number)
                    self.assertNotEqual(process.wait(timeout=10), 0)
                    self.assertEqual(termios.tcgetattr(master), original)
                    self.assertFalse((root / "must-not-transfer").exists())
                finally:
                    if process.poll() is None:
                        process.kill()
                        process.wait()
                    os.close(master)


if __name__ == "__main__":
    unittest.main()
