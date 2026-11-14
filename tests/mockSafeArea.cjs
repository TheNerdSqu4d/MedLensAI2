const React = require('react');

let currentInsets = { top: 47, bottom: 34, left: 0, right: 0 };

module.exports = {
  useSafeAreaInsets: () => currentInsets,
  setMockInsets: (insets) => { currentInsets = insets; },
  SafeAreaView: (props) => React.createElement('SafeAreaView', props, props.children),
  SafeAreaProvider: (props) => React.createElement('SafeAreaProvider', props, props.children),
};
