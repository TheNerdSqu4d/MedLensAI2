const React = require('react');

function Tabs(props) {
  return React.createElement('Tabs', props, props.children);
}

Tabs.Screen = function TabsScreen(props) {
  return React.createElement('Tabs.Screen', props);
};

module.exports = {
  Tabs,
  useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }),
  useFocusEffect: (callback) => {
    // In mock/test environment, no-op or run once safely
    if (typeof callback === 'function') {
      try {
        const cleanup = callback();
        if (typeof cleanup === 'function') cleanup();
      } catch {}
    }
  },
};
