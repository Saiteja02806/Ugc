"""No third-party dependencies. Run: python -m unittest discover -s tests -v"""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


class CostGuardianTests(unittest.TestCase):
    def test_deployments_reports_fanout_and_partial_cpu(self):
        p = subprocess.run([sys.executable, str(ROOT / 'scripts/analyze_deployments.py'),
                            '--input', str(ROOT / 'tests/sample-deployments.json')],
                           capture_output=True, text=True, check=True)
        self.assertIn('Cross-project fanout', p.stdout)
        self.assertIn('Repeated failures', p.stdout)
        self.assertIn('Known subtotal:', p.stdout)
        self.assertIn('Dollars UNKNOWN', p.stdout)

    def test_static_repo_readonly_audit(self):
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            (d / 'package.json').write_text(json.dumps({
                'scripts': {'build': 'next build && npm run lint', 'postinstall': 'playwright install'},
                'workspaces': ['apps/*']}), encoding='utf8')
            (d / '.github/workflows').mkdir(parents=True)
            (d / '.github/workflows/deploy.yml').write_text('run: npx vercel deploy --prod', encoding='utf8')
            (d / 'vercel.json').write_text('{"ignoreCommand":"bash ignore.sh"}', encoding='utf8')
            p = subprocess.run([sys.executable, str(ROOT / 'scripts/audit_repo.py'), '--repo', str(d)],
                               capture_output=True, text=True, check=True)
            self.assertIn('Possibly expensive install hook', p.stdout)
            self.assertIn('GitHub Actions deploy command', p.stdout)
            self.assertIn('Custom ignored build step', p.stdout)
            self.assertIn('Workspace detected', p.stdout)
            self.assertIn('read-only', p.stdout)


if __name__ == '__main__':
    unittest.main()
