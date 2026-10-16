import importlib.util
from pathlib import Path
import unittest
import os
import subprocess
import tempfile

spec = importlib.util.spec_from_file_location('ci_scope', Path(__file__).parents[1] / 'tools/ci-scope.py')
scope = importlib.util.module_from_spec(spec)
spec.loader.exec_module(scope)


class ScopeTests(unittest.TestCase):
    def test_only_allowlisted_markdown_can_reduce_pr_work(self):
        self.assertTrue(scope.documentation_only(['README.md', 'docs/a.md', 'wiki/b.md']))
        for paths in [[], [''], ['docs/a.md', 'src/server.js'], ['docs/run.py'],
                      ['docs/a.json'], ['unknown.md'], ['package-lock.json'], ['VERSION'],
                      ['.github/workflows/validate.yml'], ['tools/ci-scope.py'], ['test/a.test.js'],
                      ['windows-agent/a.cs'], ['agents/android-tv/a.kt'], ['Dockerfile'],
                      ['maintenance-agent/Dockerfile'], ['docs/../src/a.md']]:
            with self.subTest(paths=paths):
                self.assertFalse(scope.documentation_only(paths))

    def test_main_release_manual_and_unknown_events_always_run_full(self):
        for event in ['push', 'workflow_dispatch', 'workflow_run', '', 'pull_request_target']:
            self.assertTrue(scope.full_required(event, 'main', 'a' * 40, lambda _: ['docs/a.md']))

    def test_invalid_base_and_read_failures_fall_back_to_full(self):
        for base_ref, sha in [('other', 'a' * 40), ('main', ''), ('main', '--upload-pack=bad')]:
            self.assertTrue(scope.full_required('pull_request', base_ref, sha, lambda _: ['docs/a.md']))
        def failed(_):
            raise RuntimeError('fetch/diff failed')
        self.assertTrue(scope.full_required('pull_request', 'main', 'a' * 40, failed))

    def test_rename_out_of_source_and_deletion_are_not_hidden(self):
        self.assertTrue(scope.full_required('pull_request', 'main', 'a' * 40,
                                           lambda _: ['src/removed.js', 'docs/renamed.md']))
        self.assertTrue(scope.full_required('pull_request', 'main', 'a' * 40,
                                           lambda _: ['windows-agent/deleted.cs']))
        self.assertFalse(scope.full_required('pull_request', 'main', 'a' * 40,
                                            lambda _: ['docs/deleted.md']))

    def test_real_git_diff_includes_rename_sources_and_handles_deleted_docs(self):
        with tempfile.TemporaryDirectory() as directory:
            previous = Path.cwd()
            os.chdir(directory)
            try:
                def git(*args):
                    return subprocess.run(['git', *args], check=True, capture_output=True, text=True,
                                          env={**os.environ, 'GIT_AUTHOR_NAME': 'Fixture',
                                               'GIT_COMMITTER_NAME': 'Fixture', 'GIT_AUTHOR_EMAIL': 'fixture@example.invalid',
                                               'GIT_COMMITTER_EMAIL': 'fixture@example.invalid'}).stdout.strip()
                git('init', '-b', 'main')
                git('remote', 'add', 'origin', directory)
                Path('src').mkdir()
                Path('docs').mkdir()
                Path('src/source.js').write_text('source')
                Path('docs/guide.md').write_text('guide')
                git('add', '.')
                git('commit', '-m', 'baseline')
                base = git('rev-parse', 'HEAD')
                Path('docs/guide.md').unlink()
                git('add', '.')
                git('commit', '-m', 'delete documentation')
                self.assertEqual(scope.changed_paths(base), ['docs/guide.md'])
                base = git('rev-parse', 'HEAD')
                git('mv', 'src/source.js', 'docs/source.md')
                git('commit', '-m', 'move source under docs')
                self.assertEqual(set(scope.changed_paths(base)), {'src/source.js', 'docs/source.md'})
                self.assertTrue(scope.full_required('pull_request', 'main', base, scope.changed_paths))
            finally:
                os.chdir(previous)


if __name__ == '__main__':
    unittest.main()
