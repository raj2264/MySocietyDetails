import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Animated,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import AppLayout from '../components/AppLayout';
import * as Linking from 'expo-linking';
import { openFileLocally } from '../utils/file-opener';

const PollsScreen = () => {
  const { theme, isDarkMode } = useTheme();
  const { user, residentData } = useAuth();
  const [polls, setPolls] = useState([]);
  const [pollOptions, setPollOptions] = useState({});
  const [pollVotes, setPollVotes] = useState({});
  const [userVotes, setUserVotes] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  
  // Animation values
  const fadeAnim = useState(new Animated.Value(0))[0];
  const translateY = useState(new Animated.Value(20))[0];
  
  const startAnimation = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  };
  
  const resetAnimation = () => {
    fadeAnim.setValue(0);
    translateY.setValue(20);
  };
  
  // Helper function to format date
  const formatDate = (dateString) => {
    if (!dateString) return 'No expiration';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric'
    });
  };
  
  // Helper function to get time remaining
  const getTimeRemaining = (dateString) => {
    if (!dateString) return 'No expiration';
    
    const expireDate = new Date(dateString);
    const now = new Date();
    
    if (now > expireDate) return 'Expired';
    
    const diffMs = expireDate - now;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (diffDays > 0) {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} remaining`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} remaining`;
    } else {
      return 'Less than an hour remaining';
    }
  };
  
  // Fetch polls from Supabase
  const fetchPolls = async () => {
    try {
      if (!residentData?.society_id) {
        console.log('No society ID found in resident data');
        setPolls([]);
        setError('Unable to fetch polls. No society information found.');
        return;
      }
      
      console.log('Fetching polls for society ID:', residentData.society_id);
      
      // Get active polls
      const { data: pollsData, error: pollsError } = await supabase
        .from('polls')
        .select('*')
        .eq('society_id', residentData.society_id)
        .eq('active', true)
        .order('created_at', { ascending: false });
      
      if (pollsError) {
        console.error('Error fetching polls:', pollsError.message);
        setError(`Unable to load polls: ${pollsError.message}`);
        return;
      }
      
      if (!pollsData || pollsData.length === 0) {
        setPolls([]);
        setPollOptions({});
        setPollVotes({});
        setUserVotes({});
        return;
      }
      
      // Get poll options
      const pollIds = pollsData.map(poll => poll.id);
      const { data: optionsData, error: optionsError } = await supabase
        .from('poll_options')
        .select('*')
        .in('poll_id', pollIds);
      
      if (optionsError) {
        console.error('Error fetching poll options:', optionsError.message);
        setError(`Unable to load poll options: ${optionsError.message}`);
        return;
      }
      
      // Organize options by poll_id
      const optionsByPoll = {};
      optionsData.forEach(option => {
        if (!optionsByPoll[option.poll_id]) {
          optionsByPoll[option.poll_id] = [];
        }
        optionsByPoll[option.poll_id].push(option);
      });
      
      // Get vote counts using the RPC function
      const { data: votesData, error: votesError } = await supabase
        .rpc('get_poll_vote_counts', { poll_ids: pollIds });
      
      if (votesError) {
        console.error('Error fetching vote counts:', votesError.message);
      }
      
      // Organize vote counts by poll_id and option_id
      const votesByPoll = {};
      if (votesData) {
        votesData.forEach(vote => {
          if (!votesByPoll[vote.poll_id]) {
            votesByPoll[vote.poll_id] = {};
          }
          votesByPoll[vote.poll_id][vote.option_id] = parseInt(vote.vote_count);
        });
      }
      
      // Get user's own votes
      const { data: userVotesData, error: userVotesError } = await supabase
        .from('poll_votes')
        .select('poll_id, option_id')
        .eq('user_id', user.id)
        .in('poll_id', pollIds);
      
      if (userVotesError) {
        console.error('Error fetching user votes:', userVotesError.message);
      }
      
      // Organize user votes by poll_id
      const userVotesByPoll = {};
      if (userVotesData) {
        userVotesData.forEach(vote => {
          userVotesByPoll[vote.poll_id] = vote.option_id;
        });
      }
      
      // Update state
      setPolls(pollsData);
      setPollOptions(optionsByPoll);
      setPollVotes(votesByPoll);
      setUserVotes(userVotesByPoll);
      
      // Animate
      resetAnimation();
      setTimeout(startAnimation, 150);
      
      console.log(`Successfully fetched ${pollsData.length} polls`);
    } catch (error) {
      console.error('Exception while fetching polls:', error);
      setError(`Unable to load polls: ${error.message}`);
    }
  };
  
  // Submit a vote for a poll
  const submitVote = async (pollId, optionId) => {
    try {
      // Check if user has already voted for this poll
      if (userVotes[pollId]) {
        Alert.alert(
          'Already voted',
          'You have already voted in this poll. Would you like to change your vote?',
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Change Vote',
              onPress: async () => {
                // Delete previous vote
                const { error: deleteError } = await supabase
                  .from('poll_votes')
                  .delete()
                  .eq('poll_id', pollId)
                  .eq('user_id', user.id);
                
                if (deleteError) {
                  console.error('Error deleting previous vote:', deleteError.message);
                  Alert.alert('Error', 'Unable to change your vote. Please try again.');
                  return;
                }
                
                // Submit new vote
                const { error: insertError } = await supabase
                  .from('poll_votes')
                  .insert({
                    poll_id: pollId,
                    option_id: optionId,
                    user_id: user.id,
                  });
                
                if (insertError) {
                  console.error('Error submitting vote:', insertError.message);
                  Alert.alert('Error', 'Unable to submit your vote. Please try again.');
                  return;
                }
                
                // Update local state
                setUserVotes(prev => ({
                  ...prev,
                  [pollId]: optionId,
                }));
                
                // Update vote counts
                fetchPolls();
                
                Alert.alert('Success', 'Your vote has been updated!');
              },
            },
          ]
        );
        return;
      }
      
      // Submit new vote
      const { error } = await supabase
        .from('poll_votes')
        .insert({
          poll_id: pollId,
          option_id: optionId,
          user_id: user.id,
        });
      
      if (error) {
        console.error('Error submitting vote:', error.message);
        Alert.alert('Error', 'Unable to submit your vote. Please try again.');
        return;
      }
      
      // Update local state
      setUserVotes(prev => ({
        ...prev,
        [pollId]: optionId,
      }));
      
      // Update vote counts
      fetchPolls();
      
      Alert.alert('Success', 'Your vote has been recorded!');
    } catch (error) {
      console.error('Exception while submitting vote:', error);
      Alert.alert('Error', `Unable to submit your vote: ${error.message}`);
    }
  };
  
  // Set up real-time subscription to poll votes
  useEffect(() => {
    if (!residentData?.society_id) return;
    
    const subscription = supabase
      .channel('poll-votes-changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'poll_votes' 
        }, 
        () => {
          console.log('Poll votes changed, refreshing data');
          fetchPolls();
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(subscription);
    };
  }, [residentData?.society_id]);
  
  // This effect runs when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      fetchPolls().finally(() => setIsLoading(false));
      
      return () => {
        // Clean up if needed
      };
    }, [residentData?.society_id])
  );
  
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchPolls();
    setIsRefreshing(false);
  };
  
  // Calculate vote percentages for display
  const getVotePercentages = (pollId) => {
    const options = pollOptions[pollId] || [];
    const votes = pollVotes[pollId] || {};
    
    // Calculate total votes
    let totalVotes = 0;
    options.forEach(option => {
      totalVotes += votes[option.id] || 0;
    });
    
    // Calculate percentage for each option
    const percentages = {};
    options.forEach(option => {
      const optionVotes = votes[option.id] || 0;
      percentages[option.id] = totalVotes > 0 ? Math.round((optionVotes / totalVotes) * 100) : 0;
    });
    
    return { percentages, totalVotes };
  };
  
  const handleAttachmentPress = async (url) => {
    try {
      await openFileLocally(url);
    } catch (error) {
      console.error('Error opening attachment:', error);
      Alert.alert('Error', 'Failed to open attachment');
    }
  };

  const getFileIcon = (fileName) => {
    const ext = fileName?.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf':
        return 'picture-as-pdf';
      case 'doc':
      case 'docx':
        return 'description';
      case 'jpg':
      case 'jpeg':
      case 'png':
        return 'image';
      default:
        return 'insert-drive-file';
    }
  };
  
  const renderPollOption = (pollId, option, index) => {
    const { percentages, totalVotes } = getVotePercentages(pollId);
    const isSelected = userVotes[pollId] === option.id;
    const percentage = percentages[option.id] || 0;
    const votesCount = (pollVotes[pollId] && pollVotes[pollId][option.id]) || 0;
    
    return (
      <TouchableOpacity
        key={option.id}
        style={[
          styles.optionContainer,
          {
            backgroundColor: isDarkMode ? '#2a2a2a' : '#f5f5f5',
            borderColor: isDarkMode ? '#404040' : '#e0e0e0',
            opacity: isSelected ? 1 : 0.7,
          },
        ]}
        onPress={() => !isSelected && submitVote(pollId, option.id)}
        disabled={isSelected}
      >
        <View style={styles.optionContent}>
          <View style={styles.optionTextContainer}>
            <Text style={[styles.optionText, { color: theme.text }]}>
              {option.option_text}
            </Text>
            
            {option.attachment_url && (
              <TouchableOpacity
                onPress={() => handleAttachmentPress(option.attachment_url)}
                style={[
                  styles.attachmentButton,
                  { backgroundColor: isDarkMode ? '#404040' : '#e0e0e0' }
                ]}
              >
                <MaterialIcons
                  name={getFileIcon(option.attachment_name)}
                  size={16}
                  color={isDarkMode ? '#fff' : '#666'}
                />
                <Text
                  style={[
                    styles.attachmentText,
                    { color: isDarkMode ? '#fff' : '#666' }
                  ]}
                  numberOfLines={1}
                >
                  {option.attachment_name}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.voteInfo}>
            <Text style={[styles.percentage, { color: theme.text }]}>
              {percentage}%
            </Text>
            <Text style={[styles.voteCount, { color: theme.textSecondary }]}>
              {votesCount} {votesCount === 1 ? 'vote' : 'votes'}
            </Text>
          </View>
        </View>

        <View style={styles.progressBarContainer}>
          <View
            style={[
              styles.progressBar,
              {
                width: `${percentage}%`,
                backgroundColor: isDarkMode ? '#4a9eff' : '#2196f3',
              },
            ]}
          />
        </View>
      </TouchableOpacity>
    );
  };
  
  const renderPollItem = ({ item: poll, index }) => {
    const options = pollOptions[poll.id] || [];
    const { totalVotes } = getVotePercentages(poll.id);
    const hasVoted = !!userVotes[poll.id];
    const isExpired = poll.expires_at && new Date(poll.expires_at) < new Date();
    
    return (
      <Animated.View
        style={[
          styles.pollCard,
          {
            backgroundColor: theme.card,
            opacity: fadeAnim,
            transform: [{ translateY: translateY }],
            borderColor: isDarkMode ? '#333' : '#e0e0e0',
          },
        ]}
      >
        <View style={styles.pollHeader}>
          <Text style={[styles.pollTitle, { color: theme.text }]}>{poll.title}</Text>
          <View style={[styles.pollMeta, { 
            backgroundColor: isDarkMode ? '#2a2a2a' : '#f5f5f5',
            borderColor: isDarkMode ? '#444' : '#e0e0e0'
          }]}>
            {isExpired ? (
              <Text style={[styles.timeRemaining, { color: '#ff5252' }]}>
                <Ionicons name="time-outline" size={12} style={styles.timeIcon} /> Expired
              </Text>
            ) : (
              <Text style={[styles.timeRemaining, { 
                color: isDarkMode ? '#7bbfff' : '#2196f3'
              }]}>
                <Ionicons name="time-outline" size={12} style={styles.timeIcon} /> {getTimeRemaining(poll.expires_at)}
              </Text>
            )}
          </View>
        </View>
        
        <Text style={[styles.pollDescription, { 
          color: isDarkMode ? '#ddd' : '#444'
        }]}>
          {poll.description}
        </Text>
        
        <View style={styles.optionsContainer}>
          {options.map((option, index) => renderPollOption(poll.id, option, index))}
        </View>
        
        <View style={[styles.pollFooter, {
          borderTopColor: isDarkMode ? '#333' : '#eee'
        }]}>
          <Text style={[styles.pollFooterText, { 
            color: isDarkMode ? '#bbb' : '#666',
            fontWeight: '500'
          }]}>
            {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'} total
          </Text>
          {hasVoted ? (
            <Text style={[styles.pollStatus, { color: '#4caf50' }]}>
              <Ionicons name="checkmark-circle" size={16} /> You voted
            </Text>
          ) : isExpired ? (
            <Text style={[styles.pollStatus, { color: '#ff5252' }]}>
              <Ionicons name="close-circle" size={16} /> Poll closed
            </Text>
          ) : (
            <Text style={[styles.pollStatus, { 
              color: isDarkMode ? '#7bbfff' : '#2196f3'
            }]}>
              <Ionicons name="hand-right" size={16} /> Vote now
            </Text>
          )}
        </View>
      </Animated.View>
    );
  };
  
  const EmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <Ionicons 
        name="bar-chart" 
        size={64} 
        color={isDarkMode ? '#666' : '#ccc'} 
      />
      <Text style={[styles.emptyTitle, { color: theme.text }]}>
        No Active Polls
      </Text>
      <Text style={[styles.emptyDescription, { 
        color: isDarkMode ? '#bbb' : '#666'
      }]}>
        There are currently no active polls in your society. Check back later for new polls.
      </Text>
    </View>
  );
  
  const renderContent = () => {
    if (isLoading && !isRefreshing) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: isDarkMode ? '#ddd' : '#666' }]}>
            Loading polls...
          </Text>
        </View>
      );
    }
    
    if (error) {
      return (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={70} color="#ff5252" />
          <Text style={[styles.errorTitle, { color: theme.text }]}>
            Couldn't Load Polls
          </Text>
          <Text style={[styles.errorDescription, { color: isDarkMode ? '#ddd' : '#666' }]}>
            {error}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: theme.primary }]}
            onPress={() => {
              setError(null);
              setIsLoading(true);
              fetchPolls().finally(() => setIsLoading(false));
            }}
          >
            <Text style={styles.retryButtonText}>
              Retry
            </Text>
          </TouchableOpacity>
        </View>
      );
    }
    
    return (
      <FlatList
        data={polls}
        renderItem={renderPollItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={EmptyComponent}
        showsVerticalScrollIndicator={false}
        initialNumToRender={3}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
      />
    );
  };
  
  return (
    <AppLayout title="Polls">
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {renderContent()}
      </View>
    </AppLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 100,
  },
  pollCard: {
    borderRadius: 16,
    marginVertical: 10,
    padding: 18,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 1,
  },
  pollHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  pollTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 12,
  },
  pollMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
  },
  timeIcon: {
    marginRight: 4,
  },
  timeRemaining: {
    fontSize: 12,
    fontWeight: '600',
  },
  pollDescription: {
    marginBottom: 16,
    fontSize: 15,
    lineHeight: 22,
  },
  optionsContainer: {
    marginBottom: 16,
  },
  optionContainer: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  optionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  optionTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  optionText: {
    fontSize: 16,
    marginBottom: 4,
  },
  attachmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
    borderRadius: 4,
    marginTop: 4,
    maxWidth: '100%',
  },
  attachmentText: {
    fontSize: 12,
    marginLeft: 4,
    flex: 1,
  },
  voteInfo: {
    alignItems: 'flex-end',
  },
  percentage: {
    fontSize: 16,
    fontWeight: '600',
  },
  voteCount: {
    fontSize: 12,
    marginTop: 2,
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  pollFooter: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  pollFooterText: {
    fontSize: 13,
  },
  pollStatus: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    marginTop: 80,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  errorDescription: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
  },
  retryButton: {
    marginTop: 24,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default PollsScreen; 