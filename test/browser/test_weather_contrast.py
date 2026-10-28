"""Weather content remains legible in each supported workspace theme."""
import unittest
import test_weather_workspace as weather
import test_workspaces as workspaces


class WeatherContrastBrowserTests(unittest.TestCase):
    setUpClass = classmethod(workspaces.WorkspaceBrowserTests.setUpClass.__func__)
    tearDownClass = classmethod(workspaces.WorkspaceBrowserTests.tearDownClass.__func__)
    evidence = workspaces.WorkspaceBrowserTests.evidence

    def page(self, *args, **kwargs):
        return workspaces.WorkspaceBrowserTests.page(self, *args, theme={'mode': self.mode}, **kwargs)

    def check_theme(self, mode):
        self.mode = mode
        page, errors, _ = weather.weather_page(self, 390 if mode == 'light' else 1440)
        if mode == 'system':
            page.emulate_media(color_scheme='light')
        page.wait_for_function(f"document.documentElement.dataset.brandMode === '{mode}'")
        values = page.locator('#weather').evaluate(r"""root => {
          const luminance=color=>{
            const rgb=color.match(/[\d.]+/g).slice(0,3).map(Number).map(x=>{
              x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;
            });return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
          };
          const result={};
          for(const selector of ['.weatherMetric','.weatherSportsCard','.weatherDay h3','.weatherDay p','.weatherDay strong','.weatherNotice','.weatherSource']){
            const node=root.querySelector(selector);let host=node;
            while(host&&getComputedStyle(host).backgroundColor==='rgba(0, 0, 0, 0)')host=host.parentElement;
            const fg=luminance(getComputedStyle(node).color),bg=luminance(getComputedStyle(host).backgroundColor);
            result[selector]=(Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05);
          }return result;
        }""")
        for selector, ratio in values.items():
            self.assertGreaterEqual(ratio, 4.5, (mode, selector, values))
        self.evidence(page, errors, 'weather-contrast-'+mode)
        self.assertEqual(errors, [])

    def test_weather_light_contrast(self):
        self.check_theme('light')

    def test_weather_dark_contrast(self):
        self.check_theme('dark')

    def test_weather_system_light_contrast(self):
        self.check_theme('system')
