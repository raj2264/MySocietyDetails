import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  Platform,
  SectionList,
  ScrollView,
  useColorScheme,
  Animated,
  Dimensions,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Modal from 'react-native-modal';
import AppLayout from '../components/AppLayout';
import { useTheme } from '../context/ThemeContext';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const MeetingsScreen = () => {
  const [meetings, setMeetings] = useState([]);
  const [sectionedMeetings, setSectionedMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [minutesModalVisible, setMinutesModalVisible] = useState(false);
  const [societyId, setSocietyId] = useState(null);
  const [activeTab, setActiveTab] = useState('committee'); // Changed default to 'committee'
  const [activeFilter, setActiveFilter] = useState('all'); // 'all', 'upcoming', 'past'
  const [forceRefresh, setForceRefresh] = useState(0); // Counter to force re-renders
  const tabIndicator = React.useRef(new Animated.Value(0)).current;
  const sectionListRef = useRef(null);
  const { session } = useAuth();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { theme, isDarkMode } = useTheme();
  const router = useRouter();

  // Theme colors
  const colors = {
    background: isDark ? '#121212' : '#F9FAFB',
    card: isDark ? '#1E1E1E' : '#FFFFFF',
    text: isDark ? '#E1E1E1' : '#111827',
    textSecondary: isDark ? '#A0A0A0' : '#6B7280',
    border: isDark ? '#2A2A2A' : '#E5E7EB',
    primary: '#3B82F6',
    primaryLight: isDark ? '#3B82F620' : '#EFF6FF',
    success: '#10B981',
    danger: '#DC2626',
    purple: '#8B5CF6',
  };

  const fetchSocietyId = async () => {
    try {
      if (!session?.user?.id) return;

      const { data, error } = await supabase
        .from('residents')
        .select('society_id')
        .eq('user_id', session.user.id)
        .single();

      if (error) {
        console.error('Error fetching society ID:', error);
        return;
      }

      setSocietyId(data.society_id);
    } catch (error) {
      console.error('Error in fetchSocietyId:', error);
    }
  };

  const fetchMeetings = async () => {
    try {
      if (!societyId) return;

      setLoading(true);
      // First, let's get the meetings
      const { data: meetingsData, error: meetingsError } = await supabase
        .from('meetings')
        .select('*')
        .eq('society_id', societyId)
        .order('meeting_date', { ascending: false });

      if (meetingsError) {
        throw meetingsError;
      }

      // Log meetings data for debugging
      console.log(`Fetched ${meetingsData.length} meetings`);
      
      // Normalize meeting data to ensure consistent types and valid values
      const normalizedMeetings = meetingsData.map(meeting => {
        // Create a copy to avoid mutating the original data
        const normalizedMeeting = { ...meeting };
        
        // Ensure meeting_type is valid
        if (!normalizedMeeting.meeting_type) {
          console.warn(`Meeting ${normalizedMeeting.id} missing meeting_type, defaulting to committee`);
          normalizedMeeting.meeting_type = 'committee';
        } else {
          // Normalize to lowercase and ensure it's one of our valid types
          const type = normalizedMeeting.meeting_type.toLowerCase().trim();
          if (type === 'committee' || type === 'annual') {
            normalizedMeeting.meeting_type = type;
          } else {
            console.warn(`Meeting ${normalizedMeeting.id} has invalid meeting_type: ${type}, defaulting to committee`);
            normalizedMeeting.meeting_type = 'committee';
          }
        }
        
        return normalizedMeeting;
      });
      
      // Verify meeting_type field exists and has correct values
      const typeCounts = {
        committee: normalizedMeetings.filter(m => m.meeting_type === 'committee').length,
        annual: normalizedMeetings.filter(m => m.meeting_type === 'annual').length
      };
      
      console.log('Meeting type counts after normalization:', typeCounts);

      // Then, get the meeting notes for these meetings
      const meetingIds = normalizedMeetings.map(meeting => meeting.id);
      const { data: notesData, error: notesError } = await supabase
        .from('meeting_notes')
        .select('*')
        .in('meeting_id', meetingIds);

      if (notesError) {
        throw notesError;
      }

      // Combine the data
      const transformedData = normalizedMeetings.map(meeting => {
        const meetingNote = notesData?.find(note => note.meeting_id === meeting.id);
        return {
          ...meeting,
          meeting_minutes: meetingNote ? [{
            id: meetingNote.id,
            content: meetingNote.note_content || meetingNote.content || meetingNote.minutes || '',
            created_at: meetingNote.created_at,
            updated_at: meetingNote.updated_at
          }] : []
        };
      });

      // Log transformed data for debugging
      console.log(`Processed ${transformedData.length} meetings with notes`);
      
      // Update meetings state
      setMeetings(transformedData);
      
      // Immediately update sections with the new data
      updateSectionedMeetings(transformedData);
      
      // Force a refresh of the component
      setForceRefresh(prev => prev + 1);
    } catch (error) {
      console.error('Error fetching meetings:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Update sectioned meetings based on active tab and filter
  const updateSectionedMeetings = useCallback((data) => {
    // Clear existing sections first
    setSectionedMeetings([]);
    
    if (!data) data = meetings;
    if (!data || data.length === 0) {
      console.log('No meeting data available');
      return;
    }
    
    console.log(`Updating sections with ${data.length} meetings, tab: ${activeTab}, filter: ${activeFilter}`);
    
    try {
      // Filter based on meeting type - ensure case insensitive comparison
      let filteredMeetings = [];
      if (activeTab === 'committee') {
        filteredMeetings = data.filter(meeting => {
          const type = (meeting.meeting_type || '').toLowerCase();
          return type === 'committee';
        });
      } else if (activeTab === 'annual') {
        filteredMeetings = data.filter(meeting => {
          const type = (meeting.meeting_type || '').toLowerCase();
          return type === 'annual';
        });
      }
      
      console.log(`After type filtering: ${filteredMeetings.length} meetings match ${activeTab} type`);
      
      // If no meetings match the current tab, return empty sections
      if (filteredMeetings.length === 0) {
        console.log('No meetings match current tab filter');
        return;
      }
      
      // Create a copy for status filtering
      let upcomingMeetings = [];
      let pastMeetings = [];
      
      // Separate into upcoming and past
      filteredMeetings.forEach(meeting => {
        const now = new Date();
        const meetingDate = new Date(meeting.meeting_date);
        const status = meeting.status || 'scheduled';
        
        // If meeting is completed or the date has passed, it's a past meeting
        if (status === 'completed' || meetingDate < now) {
          pastMeetings.push(meeting);
        } else {
          upcomingMeetings.push(meeting);
        }
      });
      
      console.log(`Separated meetings: ${upcomingMeetings.length} upcoming, ${pastMeetings.length} past`);
      
      // Create sections based on filter
      const newSections = [];
      
      if (activeFilter === 'all') {
        // Only add upcoming section if there are upcoming meetings
        if (upcomingMeetings.length > 0) {
          newSections.push({
            title: 'Upcoming Meetings',
            data: upcomingMeetings,
            id: 'upcoming'
          });
        }
        
        // Only add past section if there are past meetings
        if (pastMeetings.length > 0) {
          newSections.push({
            title: 'Past Meetings',
            data: pastMeetings,
            id: 'past'
          });
        }
      } else if (activeFilter === 'upcoming') {
        // Only add upcoming section if there are upcoming meetings
        if (upcomingMeetings.length > 0) {
          newSections.push({
            title: 'Upcoming Meetings',
            data: upcomingMeetings,
            id: 'upcoming'
          });
        }
      } else if (activeFilter === 'past') {
        // Only add past section if there are past meetings
        if (pastMeetings.length > 0) {
          newSections.push({
            title: 'Past Meetings',
            data: pastMeetings,
            id: 'past'
          });
        }
      }
      
      console.log(`Created ${newSections.length} sections with data`);
      
      // Update state with new sections
      setSectionedMeetings(newSections);
    } catch (error) {
      console.error('Error updating sections:', error);
    }
  }, [activeTab, activeFilter, meetings]);

  // Handle tab change
  const handleTabChange = (tab) => {
    if (tab === activeTab) return; // Don't update if tab is already active
    
    console.log(`Tab changed from ${activeTab} to ${tab}`);
    
    // Update active tab
    setActiveTab(tab);
    
    // Animate the tab indicator
    let toValue = 0;
    if (tab === 'committee') toValue = 0;
    else if (tab === 'annual') toValue = 1;
    
    Animated.spring(tabIndicator, {
      toValue,
      friction: 8,
      tension: 60,
      useNativeDriver: true
    }).start();
    
    // Show loading indicator
    setLoading(true);
    
    // Force a refresh of the component
    setForceRefresh(prev => prev + 1);
    
    // Fetch fresh data when changing tabs
    if (societyId) {
      fetchMeetings();
    } else {
      // If no society ID yet, just update sections with current data
      updateSectionedMeetings(meetings);
      setLoading(false);
    }
  };

  // Handle filter change
  const handleFilterChange = (filter) => {
    if (filter === activeFilter) return; // Don't update if filter is already active
    
    console.log(`Filter changed from ${activeFilter} to ${filter}`);
    
    // Update active filter
    setActiveFilter(filter);
    
    // Show loading indicator briefly for better UX
    setLoading(true);
    
    // Force a refresh of the component
    setForceRefresh(prev => prev + 1);
    
    // Update the sectioned meetings
    updateSectionedMeetings(meetings);
    setLoading(false);
  };

  // Update sections when activeTab or activeFilter changes
  useEffect(() => {
    console.log('Tab or filter changed, updating sections');
    updateSectionedMeetings(meetings);
  }, [activeTab, activeFilter, meetings, updateSectionedMeetings]);

  // Ensure meetings are re-filtered when they change
  useEffect(() => {
    if (meetings.length > 0) {
      console.log('Meetings data changed, updating sections');
      updateSectionedMeetings(meetings);
    }
  }, [meetings, updateSectionedMeetings]);

  useEffect(() => {
    fetchSocietyId();
  }, [session]);

  useEffect(() => {
    if (societyId) {
      fetchMeetings();
    }
  }, [societyId]);

  useFocusEffect(
    useCallback(() => {
      if (societyId) {
        fetchMeetings();
      }
    }, [societyId])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchMeetings();
  };

  const handleMeetingPress = (meeting) => {
    setSelectedMeeting(meeting);
    if (meeting.meeting_minutes && meeting.meeting_minutes.length > 0) {
      setMinutesModalVisible(true);
    }
  };

  const getStatusColor = (status, meetingDate) => {
    if (status === 'cancelled') return theme.danger;
    if (status === 'completed') return theme.success;
    
    const now = new Date();
    const meetingTime = new Date(meetingDate);
    
    if (meetingTime < now) {
      return theme.success;
    }
    
    return theme.primary;
  };

  const getStatusText = (status, meetingDate) => {
    if (!meetingDate) {
      console.warn('Meeting date is missing');
      return 'Unknown';
    }
    
    if (status === 'cancelled') return 'Cancelled';
    if (status === 'completed') return 'Completed';
    
    try {
    const now = new Date();
    const meetingTime = new Date(meetingDate);
    
    if (meetingTime < now) {
      return 'Completed';
    }
    
    return 'Upcoming';
    } catch (error) {
      console.error('Error determining meeting status:', error);
      return 'Unknown';
    }
  };
  
  const getMeetingTypeColor = (type) => {
    return type === 'annual' ? theme.secondary : theme.primary;
  };

  const renderMinutesContent = (minutes) => {
    if (!minutes || !minutes.content) return null;
    
    try {
      // Log the raw content to help debug
      console.log('Raw minutes content:', minutes.content);
      
      let content;
      if (typeof minutes.content === 'string') {
        try {
          content = JSON.parse(minutes.content);
        } catch (e) {
          // If JSON parsing fails, try to parse it as a simple object
          content = {
            topics: minutes.content,
            discussions: '',
            conclusions: '',
            notes: '',
            attendees: [],
            actionItems: [],
            attachments: []
          };
        }
      } else {
        content = minutes.content;
      }

      // Log the parsed content
      console.log('Parsed content:', content);

      return (
        <View style={[styles.minutesCard, { backgroundColor: theme.card }]}>
          <View style={styles.minutesSections}>
            <View style={[styles.minutesSection, { borderBottomColor: theme.border }]}>
              <View style={styles.sectionHeader}>
                <Ionicons name="list-outline" size={20} color={theme.primary} />
                <Text style={[styles.sectionTitle, { 
                  color: isDarkMode ? '#FFFFFF' : theme.text,
                  fontWeight: '600'
                }]}>Meeting Topics</Text>
              </View>
              <Text style={[styles.sectionContent, { 
                color: isDarkMode ? '#FFFFFF' : theme.textSecondary,
                fontWeight: '500'
              }]}>
                {content.topics || 'No topics recorded'}
              </Text>
            </View>

            <View style={[styles.minutesSection, { borderBottomColor: theme.border }]}>
              <View style={styles.sectionHeader}>
                <Ionicons name="chatbubbles-outline" size={20} color={theme.primary} />
                <Text style={[styles.sectionTitle, { 
                  color: isDarkMode ? '#FFFFFF' : theme.text,
                  fontWeight: '600'
                }]}>Discussions</Text>
              </View>
              <Text style={[styles.sectionContent, { 
                color: isDarkMode ? '#FFFFFF' : theme.textSecondary,
                fontWeight: '500'
              }]}>
                {content.discussions || 'No discussions recorded'}
              </Text>
            </View>

            <View style={[styles.minutesSection, { borderBottomColor: theme.border }]}>
              <View style={styles.sectionHeader}>
                <Ionicons name="checkmark-circle-outline" size={20} color={theme.primary} />
                <Text style={[styles.sectionTitle, { 
                  color: isDarkMode ? '#FFFFFF' : theme.text,
                  fontWeight: '600'
                }]}>Conclusions & Decisions</Text>
              </View>
              <Text style={[styles.sectionContent, { 
                color: isDarkMode ? '#FFFFFF' : theme.textSecondary,
                fontWeight: '500'
              }]}>
                {content.conclusions || 'No conclusions recorded'}
              </Text>
            </View>

            <View style={[styles.minutesSection, { borderBottomColor: theme.border }]}>
              <View style={styles.sectionHeader}>
                <Ionicons name="people-outline" size={20} color={theme.primary} />
                <Text style={[styles.sectionTitle, { 
                  color: isDarkMode ? '#FFFFFF' : theme.text,
                  fontWeight: '600'
                }]}>Attendees</Text>
              </View>
              <View style={styles.attendeesList}>
                {content.attendees && content.attendees.length > 0 ? (
                  content.attendees.map((attendee, index) => (
                    <View key={index} style={[styles.attendeeItem, { backgroundColor: isDarkMode ? '#2A2A2A' : '#F9FAFB' }]}>
                      <Ionicons name="person-outline" size={16} color={isDarkMode ? '#FFFFFF' : theme.textSecondary} />
                      <Text style={[styles.attendeeText, { 
                        color: isDarkMode ? '#FFFFFF' : theme.textSecondary,
                        fontWeight: '500'
                      }]}>{attendee}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={[styles.sectionContent, { 
                    color: isDarkMode ? '#FFFFFF' : theme.textSecondary,
                    fontWeight: '500'
                  }]}>No attendees recorded</Text>
                )}
              </View>
            </View>

            <View style={[styles.minutesSection, { borderBottomColor: theme.border }]}>
              <View style={styles.sectionHeader}>
                <Ionicons name="clipboard-outline" size={20} color={theme.primary} />
                <Text style={[styles.sectionTitle, { 
                  color: isDarkMode ? '#FFFFFF' : theme.text,
                  fontWeight: '600'
                }]}>Action Items</Text>
              </View>
              <View style={styles.actionItemsList}>
                {content.actionItems && content.actionItems.length > 0 ? (
                  content.actionItems.map((item, index) => (
                    <View key={index} style={[styles.actionItem, { 
                      backgroundColor: isDarkMode ? '#2A2A2A' : '#F9FAFB',
                      borderColor: theme.border
                    }]}>
                      <View style={styles.actionItemHeader}>
                        <Ionicons name="checkbox-outline" size={16} color={isDarkMode ? '#FFFFFF' : theme.textSecondary} />
                        <Text style={[styles.actionItemTitle, { 
                          color: isDarkMode ? '#FFFFFF' : theme.text,
                          fontWeight: '500'
                        }]}>{item.task || 'Untitled task'}</Text>
                      </View>
                      <View style={[styles.actionItemDetails, { backgroundColor: theme.card }]}>
                        <Text style={[styles.actionItemAssignee, { 
                          color: isDarkMode ? '#FFFFFF' : theme.textSecondary,
                          fontWeight: '500'
                        }]}>
                          Assigned to: {item.assignee || 'Unassigned'}
                        </Text>
                        {item.dueDate && (
                          <Text style={[styles.actionItemDueDate, { 
                            color: isDarkMode ? '#FFFFFF' : theme.textSecondary,
                            fontWeight: '500'
                          }]}>
                            Due: {format(new Date(item.dueDate), 'MMM d, yyyy')}
                          </Text>
                        )}
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={[styles.sectionContent, { 
                    color: isDarkMode ? '#FFFFFF' : theme.textSecondary,
                    fontWeight: '500'
                  }]}>No action items recorded</Text>
                )}
              </View>
            </View>

            <View style={[styles.minutesSection, { borderBottomColor: theme.border }]}>
              <View style={styles.sectionHeader}>
                <Ionicons name="attach-outline" size={20} color={theme.primary} />
                <Text style={[styles.sectionTitle, { 
                  color: isDarkMode ? '#FFFFFF' : theme.text,
                  fontWeight: '600'
                }]}>Attachments</Text>
              </View>
              <View style={styles.attachmentsList}>
                {content.attachments && content.attachments.length > 0 ? (
                  content.attachments.map((attachment, index) => (
                    <View key={index} style={[styles.attachmentItem, { 
                      backgroundColor: isDarkMode ? '#2A2A2A' : '#F9FAFB',
                      borderColor: theme.border
                    }]}>
                      <Ionicons name="document-outline" size={16} color={isDarkMode ? '#FFFFFF' : theme.textSecondary} />
                      <Text style={[styles.attachmentText, { 
                        color: isDarkMode ? '#FFFFFF' : theme.textSecondary,
                        fontWeight: '500'
                      }]}>{attachment.name || 'Unnamed attachment'}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={[styles.sectionContent, { 
                    color: isDarkMode ? '#FFFFFF' : theme.textSecondary,
                    fontWeight: '500'
                  }]}>No attachments</Text>
                )}
              </View>
            </View>

            <View style={styles.minutesSection}>
              <View style={styles.sectionHeader}>
                <Ionicons name="create-outline" size={20} color={theme.primary} />
                <Text style={[styles.sectionTitle, { 
                  color: isDarkMode ? '#FFFFFF' : theme.text,
                  fontWeight: '600'
                }]}>Additional Notes</Text>
              </View>
              <Text style={[styles.sectionContent, { 
                color: isDarkMode ? '#FFFFFF' : theme.textSecondary,
                fontWeight: '500'
              }]}>
                {content.notes || 'No additional notes'}
              </Text>
            </View>
          </View>
        </View>
      );
    } catch (error) {
      console.error('Error parsing minutes content:', error);
      return (
        <View style={styles.noMinutesContainer}>
          <Ionicons name="document-text-outline" size={48} color={isDarkMode ? '#666666' : theme.textSecondary} />
          <Text style={[styles.noMinutesText, { 
            color: isDarkMode ? '#FFFFFF' : theme.text,
            fontWeight: '600'
          }]}>Error displaying minutes</Text>
        </View>
      );
    }
  };

  const renderMeetingItem = ({ item }) => {
    // Verify meeting type for debugging
    if (!item.meeting_type) {
      console.warn('Meeting missing meeting_type:', item.id);
    } else if (activeTab === 'committee' && item.meeting_type !== 'committee') {
      console.warn(`Meeting type mismatch: expected committee, got ${item.meeting_type}`);
    } else if (activeTab === 'annual' && item.meeting_type !== 'annual') {
      console.warn(`Meeting type mismatch: expected annual, got ${item.meeting_type}`);
    }

    const meetingDate = new Date(item.meeting_date);
    const statusColor = getStatusColor(item.status, item.meeting_date);
    const statusText = getStatusText(item.status, item.meeting_date);
    const hasMinutes = item.meeting_minutes && item.meeting_minutes.length > 0;
    const typeColor = getMeetingTypeColor(item.meeting_type);

    return (
      <View style={[styles.meetingCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.meetingHeader}>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
            <Text style={[styles.statusText, { color: statusColor, fontWeight: '600' }]}>{statusText}</Text>
          </View>
          <View style={styles.headerRight}>
            {item.meeting_type === 'annual' && (
              <View style={[styles.typeBadge, { backgroundColor: `${typeColor}20` }]}>
                <Text style={[styles.typeText, { color: typeColor, fontWeight: '600' }]}>AGM</Text>
              </View>
            )}
          </View>
        </View>
        
        <Text style={[styles.meetingTitle, { 
          color: isDarkMode ? '#FFFFFF' : theme.text,
          fontWeight: '600'
        }]}>{item.title}</Text>
        
        <View style={styles.meetingDetails}>
          <View style={styles.detailRow}>
            <Ionicons name="calendar-outline" size={16} color={isDarkMode ? '#FFFFFF' : theme.textSecondary} />
            <Text style={[styles.detailText, { 
              color: isDarkMode ? '#FFFFFF' : theme.textSecondary,
              fontWeight: '500'
            }]}>
              {format(meetingDate, 'EEEE, MMMM d, yyyy')}
            </Text>
          </View>
          
          <View style={styles.detailRow}>
            <Ionicons name="time-outline" size={16} color={isDarkMode ? '#FFFFFF' : theme.textSecondary} />
            <Text style={[styles.detailText, { 
              color: isDarkMode ? '#FFFFFF' : theme.textSecondary,
              fontWeight: '500'
            }]}>
              {format(meetingDate, 'h:mm a')}
            </Text>
          </View>
          
          {item.location && (
            <View style={styles.detailRow}>
              <Ionicons name="location-outline" size={16} color={isDarkMode ? '#FFFFFF' : theme.textSecondary} />
              <Text style={[styles.detailText, { 
                color: isDarkMode ? '#FFFFFF' : theme.textSecondary,
                fontWeight: '500'
              }]}>{item.location}</Text>
            </View>
          )}
        </View>
        
        {item.description && (
          <Text style={[styles.description, { 
            color: isDarkMode ? '#FFFFFF' : theme.textSecondary,
            fontWeight: '500'
          }]} numberOfLines={2}>
            {item.description}
          </Text>
        )}
        
        {hasMinutes && (
          <TouchableOpacity 
            onPress={() => {
              setSelectedMeeting(item);
              setMinutesModalVisible(true);
            }}
            style={[styles.viewMinutesButton, { backgroundColor: theme.primary }]}
          >
            <Ionicons name="document-text-outline" size={20} color="#FFFFFF" />
            <Text style={[styles.viewMinutesButtonText, { fontWeight: '600' }]}>View Minutes</Text>
      </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderSectionHeader = ({ section }) => {
    // Don't render any section headers
    return null;
  };

  const renderEmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="calendar-outline" size={64} color={isDarkMode ? '#666666' : theme.textSecondary} />
      <Text style={[styles.emptyText, { 
        color: isDarkMode ? '#FFFFFF' : theme.text,
        fontWeight: '600'
      }]}>No meetings found</Text>
      <Text style={[styles.emptySubText, { 
        color: isDarkMode ? '#FFFFFF' : theme.textSecondary,
        fontWeight: '500'
      }]}>
        {activeFilter === 'all' 
          ? `No ${activeTab === 'committee' ? 'committee' : 'annual general'} meetings available` 
          : `No ${activeFilter} ${activeTab === 'committee' ? 'committee' : 'annual general'} meetings available`}
      </Text>
    </View>
  );

  const renderTabBar = () => {
    const tabWidth = Dimensions.get('window').width / 2; // Two equal tabs
    const translateX = tabIndicator.interpolate({
      inputRange: [0, 1],
      outputRange: [0, tabWidth]
    });

    return (
      <View style={[styles.tabBarContainer, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity 
          style={[styles.tab, { width: tabWidth }]} 
          onPress={() => handleTabChange('committee')}
          activeOpacity={0.7}
        >
          <Text style={[
            styles.tabText, 
            { 
              color: activeTab === 'committee' ? theme.primary : isDarkMode ? '#FFFFFF' : theme.textSecondary,
              fontWeight: activeTab === 'committee' ? '700' : '500'
            }
          ]}>Committee Meetings</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, { width: tabWidth }]} 
          onPress={() => handleTabChange('annual')}
          activeOpacity={0.7}
        >
          <Text style={[
            styles.tabText, 
            { 
              color: activeTab === 'annual' ? theme.primary : isDarkMode ? '#FFFFFF' : theme.textSecondary,
              fontWeight: activeTab === 'annual' ? '700' : '500'
            }
          ]}>Annual General Meetings</Text>
        </TouchableOpacity>
        
        <Animated.View 
          style={[
            styles.tabIndicator, 
            { 
              backgroundColor: theme.primary,
              width: tabWidth - 40,
              transform: [{ translateX }]
            }
          ]} 
        />
      </View>
    );
  };

  const renderFilterBar = () => {
    return (
      <View style={[styles.filterBarContainer, { backgroundColor: theme.background }]}>
        <TouchableOpacity 
          style={[
            styles.filterButton, 
            activeFilter === 'all' && [styles.activeFilterButton, { backgroundColor: `${theme.primary}20` }]
          ]} 
          onPress={() => handleFilterChange('all')}
        >
          <Text style={[
            styles.filterButtonText, 
            { color: activeFilter === 'all' ? theme.primary : isDarkMode ? '#FFFFFF' : theme.textSecondary }
          ]}>All</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[
            styles.filterButton, 
            activeFilter === 'upcoming' && [styles.activeFilterButton, { backgroundColor: `${theme.primary}20` }]
          ]} 
          onPress={() => handleFilterChange('upcoming')}
        >
          <Text style={[
            styles.filterButtonText, 
            { color: activeFilter === 'upcoming' ? theme.primary : isDarkMode ? '#FFFFFF' : theme.textSecondary }
          ]}>Upcoming</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[
            styles.filterButton, 
            activeFilter === 'past' && [styles.activeFilterButton, { backgroundColor: `${theme.primary}20` }]
          ]} 
          onPress={() => handleFilterChange('past')}
        >
          <Text style={[
            styles.filterButtonText, 
            { color: activeFilter === 'past' ? theme.primary : isDarkMode ? '#FFFFFF' : theme.textSecondary }
          ]}>Past</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderContent = () => {
    if (loading && !refreshing) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      );
    }

    // If there are no sections or all sections are empty, render the empty component directly
    if (sectionedMeetings.length === 0) {
      return (
        <>
          {renderFilterBar()}
          {renderEmptyComponent()}
        </>
      );
    }

    // Create a unique key for the SectionList that changes with every state change
    const listKey = `${activeTab}-${activeFilter}-${forceRefresh}-${sectionedMeetings.length}-${meetings.length}`;
    
    return (
      <>
        {renderFilterBar()}
        <SectionList
          ref={sectionListRef}
          key={listKey}
          sections={sectionedMeetings}
          renderItem={renderMeetingItem}
          renderSectionHeader={renderSectionHeader}
          keyExtractor={(item) => `${item.id}-${activeTab}-${activeFilter}-${forceRefresh}`}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmptyComponent}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh}
              tintColor={theme.primary}
              colors={[theme.primary]}
            />
          }
          stickySectionHeadersEnabled={false}
          removeClippedSubviews={true}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          onScrollToIndexFailed={() => {}}
          extraData={[forceRefresh, meetings.length, sectionedMeetings.length]}
        />
      </>
    );
  };

  return (
    <AppLayout title="Meetings">
      {renderTabBar()}
      {renderContent()}

      <Modal
        isVisible={minutesModalVisible}
        onBackdropPress={() => setMinutesModalVisible(false)}
        backdropOpacity={0.5}
        style={styles.modal}
        useNativeDriver={true}
        hideModalContentWhileAnimating={true}
        animationInTiming={300}
        animationOutTiming={300}
        backdropTransitionInTiming={300}
        backdropTransitionOutTiming={300}
      >
        <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
          <View style={[styles.modalHeader, { 
            backgroundColor: theme.card, 
            borderBottomColor: theme.border,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
          }]}>
            <View style={styles.modalHeaderContent}>
              <Text style={[styles.modalTitle, { 
                color: isDarkMode ? '#FFFFFF' : theme.text,
                fontWeight: '600'
              }]}>Meeting Minutes</Text>
              <TouchableOpacity 
                onPress={() => setMinutesModalVisible(false)}
                style={[styles.closeButton, { backgroundColor: isDarkMode ? '#2A2A2A' : '#F3F4F6' }]}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={24} color={isDarkMode ? '#FFFFFF' : theme.textSecondary} />
            </TouchableOpacity>
            </View>
          </View>
          
          {selectedMeeting && (
            <ScrollView 
              style={styles.modalScrollView}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={true}
            >
              <View style={styles.modalTitleRow}>
                <Text style={[styles.modalMeetingTitle, { 
                  color: isDarkMode ? '#FFFFFF' : theme.text,
                  fontWeight: '700'
                }]}>{selectedMeeting.title}</Text>
                {selectedMeeting.meeting_type === 'annual' && (
                  <View style={[styles.typeBadge, { backgroundColor: `${getMeetingTypeColor('annual')}20` }]}>
                    <Text style={[styles.typeText, { 
                      color: getMeetingTypeColor('annual'),
                      fontWeight: '600'
                    }]}>AGM</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.modalMeetingDate, { 
                color: isDarkMode ? '#FFFFFF' : theme.textSecondary,
                fontWeight: '500'
              }]}>
                {format(new Date(selectedMeeting.meeting_date), 'EEEE, MMMM d, yyyy')}
              </Text>
              
              <View style={styles.minutesContainer}>
                {selectedMeeting.meeting_minutes && 
                 selectedMeeting.meeting_minutes.length > 0 ? (
                  renderMinutesContent(selectedMeeting.meeting_minutes[0])
                ) : (
                  <View style={styles.noMinutesContainer}>
                    <Ionicons name="document-text-outline" size={48} color={isDarkMode ? '#666666' : theme.textSecondary} />
                    <Text style={[styles.noMinutesText, { 
                      color: isDarkMode ? '#FFFFFF' : theme.text,
                      fontWeight: '600'
                    }]}>No minutes available</Text>
              </View>
                )}
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>
    </AppLayout>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    padding: 16,
  },
  meetingCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 1,
  },
  meetingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
  },
  typeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  meetingTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  meetingDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  detailText: {
    fontSize: 14,
    marginLeft: 8,
  },
  description: {
    fontSize: 14,
    marginBottom: 12,
  },
  viewMinutesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 12,
  },
  viewMinutesButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  sectionHeader: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
    marginTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150,150,150,0.1)',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  modal: {
    margin: 20,
    justifyContent: 'center',
  },
  modalContent: {
    borderRadius: 16,
    maxHeight: '80%',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
  },
  modalHeader: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalHeaderContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  modalScrollView: {
    maxHeight: '100%',
  },
  modalScrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalMeetingTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginRight: 8,
    flex: 1,
  },
  modalMeetingDate: {
    fontSize: 14,
    marginBottom: 16,
  },
  minutesContainer: {
    marginBottom: 16,
  },
  minutesCard: {
    borderRadius: 16,
    padding: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  minutesSections: {
    gap: 0,
  },
  minutesSection: {
    padding: 16,
    borderBottomWidth: 1,
  },
  sectionContent: {
    fontSize: 14,
    lineHeight: 20,
  },
  attendeesList: {
    gap: 8,
  },
  attendeeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    borderRadius: 8,
  },
  attendeeText: {
    fontSize: 14,
  },
  actionItemsList: {
    gap: 12,
  },
  actionItem: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  actionItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  actionItemTitle: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  actionItemDetails: {
    marginLeft: 24,
    padding: 8,
    borderRadius: 8,
  },
  actionItemAssignee: {
    fontSize: 13,
  },
  actionItemDueDate: {
    fontSize: 13,
    marginTop: 4,
  },
  attachmentsList: {
    gap: 8,
  },
  attachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  attachmentText: {
    fontSize: 14,
  },
  closeButton: {
    padding: 4,
    borderRadius: 20,
  },
  noMinutesContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  noMinutesText: {
    fontSize: 16,
    marginTop: 12,
  },
  tabBarContainer: {
    flexDirection: 'row',
    height: 56,
    borderBottomWidth: 1,
    position: 'relative',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  tab: {
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '500',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    height: 3,
    marginLeft: 20,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  filterBarContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150,150,150,0.1)',
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginHorizontal: 4,
  },
  activeFilterButton: {
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
});

export default MeetingsScreen; 