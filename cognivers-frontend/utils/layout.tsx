import React from 'react';
import NavigationLayout from '../components/NavigationLayout';
import Layout from '../components/Layout';

export function withNavigationLayout(page: React.ReactElement) {
  return (
    <Layout>
      <NavigationLayout>{page}</NavigationLayout>
    </Layout>
  );
} 