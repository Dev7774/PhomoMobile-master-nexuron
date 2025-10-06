import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { triggerBackgroundSyncManually, getBackgroundSyncStatus } from '../src/background/TestBackgroundSync';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function DebugScreen() {
  const [status, setStatus] = useState<any>(null);
  const [processedPhotos, setProcessedPhotos] = useState<string[]>([]);

  useEffect(() => {
    loadStatus();
    loadProcessedPhotos();
  }, []);

  const loadStatus = async () => {
    const bgStatus = await getBackgroundSyncStatus();
    setStatus(bgStatus);
  };

  const loadProcessedPhotos = async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const processedKeys = keys.filter(key => key.startsWith('processed-'));
      const processedData = await AsyncStorage.multiGet(processedKeys);
      setProcessedPhotos(processedData.map(([key, value]) => `${key}: ${value}`));
    } catch (error) {
      console.error('Error loading processed photos:', error);
    }
  };

  const clearProcessedPhotos = async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const processedKeys = keys.filter(key => key.startsWith('processed-'));
      await AsyncStorage.multiRemove(processedKeys);
      setProcessedPhotos([]);
      console.log('✅ Cleared processed photos cache');
    } catch (error) {
      console.error('❌ Error clearing processed photos:', error);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Background Sync Debug</Text>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Status</Text>
        {status ? (
          <View>
            <Text>Status: {status.statusText}</Text>
            <Text>Task Registered: {status.isTaskRegistered ? 'Yes' : 'No'}</Text>
          </View>
        ) : (
          <Text>Loading...</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Actions</Text>
        <TouchableOpacity style={styles.button} onPress={triggerBackgroundSyncManually}>
          <Text style={styles.buttonText}>Trigger Manual Sync</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={loadStatus}>
          <Text style={styles.buttonText}>Refresh Status</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={clearProcessedPhotos}>
          <Text style={styles.buttonText}>Clear Processed Photos</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Processed Photos ({processedPhotos.length})</Text>
        {processedPhotos.map((photo, index) => (
          <Text key={index} style={styles.photoText}>{photo}</Text>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  section: {
    backgroundColor: 'white',
    padding: 15,
    marginBottom: 15,
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  photoText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
});