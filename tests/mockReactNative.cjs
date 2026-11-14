const React = require('react');

function createDummy(name) {
  const Component = React.forwardRef((props, ref) => {
    return React.createElement(name, { ...props, ref }, props ? props.children : undefined);
  });
  Component.displayName = name;
  return Component;
}

class MockAnimatedValue {
  constructor(val = 0) {
    this._value = val;
  }
  setValue(val) {
    this._value = val;
  }
  interpolate() {
    return this;
  }
}

module.exports = {
  View: createDummy('RCTView'),
  Text: createDummy('RCTText'),
  Pressable: createDummy('RCTPressable'),
  ScrollView: createDummy('RCTScrollView'),
  Modal: createDummy('RCTModal'),
  KeyboardAvoidingView: createDummy('RCTKeyboardAvoidingView'),
  Keyboard: {
    dismiss: () => {},
  },
  Animated: {
    Value: MockAnimatedValue,
    timing: () => ({ start: (cb) => cb && cb({ finished: true }) }),
    spring: () => ({ start: (cb) => cb && cb({ finished: true }) }),
    loop: () => ({ start: () => {}, stop: () => {} }),
    sequence: () => ({ start: (cb) => cb && cb({ finished: true }) }),
    View: createDummy('RCTAnimatedView'),
  },
  PanResponder: {
    create: (config) => ({
      panHandlers: {},
    }),
  },
  StyleSheet: {
    create: (styles) => styles,
    flatten: (styles) => styles,
  },
  Platform: {
    OS: 'ios',
    select: (obj) => obj.ios || obj.default,
  },
  Alert: {
    alert: (title, message, buttons) => {},
  },
};

