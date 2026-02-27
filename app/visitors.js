import React from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import VisitorsScreen from '../screens/VisitorsScreen';
import AppLayout from '../components/AppLayout';

export default function VisitorsRoute() {
  const { user } = useAuth();

  if (!user) {
    return <Redirect href="/login" />;
  }

  return (
    <AppLayout title="Visitors">
      <VisitorsScreen />
    </AppLayout>
  );
} 