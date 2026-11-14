import React from 'react';
import { Redirect } from 'expo-router';

// Apple Light Grouped Mode (#F2F2F7) direct redirect entry point
export default function Index() {
  return <Redirect href="/(tabs)" />;
}
