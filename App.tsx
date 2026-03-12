import React, {useState, useEffect, useRef, useCallback} from 'react';
import {
  View,
  Text,
  TouchableWithoutFeedback,
  StyleSheet,
  Dimensions,
  Animated,
  StatusBar,
  SafeAreaView,
} from 'react-native';

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');

const CIRCLE_MIN_SIZE = 50;
const CIRCLE_MAX_SIZE = 110;
const GAME_DURATION = 30; // seconds
const INITIAL_CIRCLE_LIFETIME = 2000; // ms
const MIN_CIRCLE_LIFETIME = 600; // ms

type GameState = 'idle' | 'playing' | 'gameover';

interface Circle {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  spawnTime: number;
  lifetime: number;
  scaleAnim: Animated.Value;
  opacityAnim: Animated.Value;
}

const CIRCLE_COLORS = [
  '#FF6B6B',
  '#4ECDC4',
  '#45B7D1',
  '#FFA07A',
  '#98D8C8',
  '#F7DC6F',
  '#BB8FCE',
  '#82E0AA',
  '#F1948A',
  '#85C1E9',
];

let circleIdCounter = 0;

function createCircle(lifetime: number): Circle {
  const size =
    CIRCLE_MIN_SIZE + Math.random() * (CIRCLE_MAX_SIZE - CIRCLE_MIN_SIZE);
  const padding = size / 2 + 10;
  const x = padding + Math.random() * (SCREEN_WIDTH - padding * 2);
  const y =
    120 + padding + Math.random() * (SCREEN_HEIGHT - 240 - padding * 2);
  const color = CIRCLE_COLORS[Math.floor(Math.random() * CIRCLE_COLORS.length)];

  return {
    id: ++circleIdCounter,
    x,
    y,
    size,
    color,
    spawnTime: Date.now(),
    lifetime,
    scaleAnim: new Animated.Value(0),
    opacityAnim: new Animated.Value(1),
  };
}

export default function App() {
  const [gameState, setGameState] = useState<GameState>('idle');
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [circles, setCircles] = useState<Circle[]>([]);
  const [combo, setCombo] = useState(0);
  const [missCount, setMissCount] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const spawnRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gameStateRef = useRef<GameState>('idle');
  const circleLifetimeRef = useRef(INITIAL_CIRCLE_LIFETIME);
  const scoreRef = useRef(0);
  const comboRef = useRef(0);

  const stopGame = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (spawnRef.current) clearTimeout(spawnRef.current);
    timerRef.current = null;
    spawnRef.current = null;
  }, []);

  const endGame = useCallback(() => {
    stopGame();
    gameStateRef.current = 'gameover';
    setGameState('gameover');
    setCircles([]);
    setBestScore(prev => Math.max(prev, scoreRef.current));
  }, [stopGame]);

  const spawnCircle = useCallback(() => {
    if (gameStateRef.current !== 'playing') return;

    const lifetime = circleLifetimeRef.current;
    const circle = createCircle(lifetime);

    setCircles(prev => [...prev, circle]);

    // Pop-in animation
    Animated.spring(circle.scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 200,
      friction: 8,
    }).start();

    // Fade out near end of lifetime
    const fadeDelay = lifetime * 0.65;
    setTimeout(() => {
      if (gameStateRef.current !== 'playing') return;
      Animated.timing(circle.opacityAnim, {
        toValue: 0,
        duration: lifetime * 0.35,
        useNativeDriver: true,
      }).start();
    }, fadeDelay);

    // Remove circle after lifetime (missed)
    setTimeout(() => {
      if (gameStateRef.current !== 'playing') return;
      setCircles(prev => {
        const exists = prev.find(c => c.id === circle.id);
        if (exists) {
          comboRef.current = 0;
          setCombo(0);
          setMissCount(m => m + 1);
        }
        return prev.filter(c => c.id !== circle.id);
      });
    }, lifetime);

    // Schedule next spawn
    const nextSpawn = 400 + Math.random() * 600;
    spawnRef.current = setTimeout(spawnCircle, nextSpawn);
  }, []);

  const startGame = useCallback(() => {
    circleIdCounter = 0;
    circleLifetimeRef.current = INITIAL_CIRCLE_LIFETIME;
    scoreRef.current = 0;
    comboRef.current = 0;
    gameStateRef.current = 'playing';

    setScore(0);
    setCombo(0);
    setMissCount(0);
    setTimeLeft(GAME_DURATION);
    setCircles([]);
    setGameState('playing');

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          endGame();
          return 0;
        }
        const elapsed = GAME_DURATION - prev + 1;
        const reduction = elapsed * 40;
        circleLifetimeRef.current = Math.max(
          MIN_CIRCLE_LIFETIME,
          INITIAL_CIRCLE_LIFETIME - reduction,
        );
        return prev - 1;
      });
    }, 1000);

    spawnRef.current = setTimeout(spawnCircle, 300);
  }, [spawnCircle, endGame]);

  const handleCircleTap = useCallback((circleId: number) => {
    setCircles(prev => {
      const circle = prev.find(c => c.id === circleId);
      if (!circle) return prev;

      Animated.parallel([
        Animated.spring(circle.scaleAnim, {
          toValue: 1.4,
          useNativeDriver: true,
          tension: 300,
          friction: 5,
        }),
        Animated.timing(circle.opacityAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();

      return prev.filter(c => c.id !== circleId);
    });

    comboRef.current += 1;
    setCombo(comboRef.current);

    const comboBonus = Math.floor(comboRef.current / 5);
    const points = 10 + comboBonus * 5;
    scoreRef.current += points;
    setScore(scoreRef.current);
  }, []);

  useEffect(() => {
    return () => stopGame();
  }, [stopGame]);

  const timePercent = timeLeft / GAME_DURATION;
  const timerColor =
    timeLeft > 10 ? '#4ECDC4' : timeLeft > 5 ? '#F7DC6F' : '#FF6B6B';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />

      {/* HUD */}
      <View style={styles.hud}>
        <View style={styles.hudItem}>
          <Text style={styles.hudLabel}>SCORE</Text>
          <Text style={styles.hudValue}>{score}</Text>
        </View>

        <View style={styles.timerContainer}>
          <Text style={[styles.timerText, {color: timerColor}]}>{timeLeft}</Text>
          <View style={styles.timerBar}>
            <View
              style={[
                styles.timerFill,
                {
                  width: `${timePercent * 100}%` as `${number}%`,
                  backgroundColor: timerColor,
                },
              ]}
            />
          </View>
        </View>

        <View style={styles.hudItem}>
          <Text style={styles.hudLabel}>BEST</Text>
          <Text style={styles.hudValue}>{bestScore}</Text>
        </View>
      </View>

      {/* Combo indicator */}
      {gameState === 'playing' && combo >= 5 && (
        <View style={styles.comboContainer}>
          <Text style={styles.comboText}>x{combo} COMBO!</Text>
        </View>
      )}

      {/* Game area */}
      <View
        style={styles.gameArea}
        pointerEvents={gameState === 'playing' ? 'box-none' : 'none'}>
        {circles.map(circle => (
          <Animated.View
            key={circle.id}
            style={[
              styles.circle,
              {
                left: circle.x - circle.size / 2,
                top: circle.y - circle.size / 2,
                width: circle.size,
                height: circle.size,
                borderRadius: circle.size / 2,
                backgroundColor: circle.color,
                transform: [{scale: circle.scaleAnim}],
                opacity: circle.opacityAnim,
              },
            ]}>
            <TouchableWithoutFeedback
              onPress={() => handleCircleTap(circle.id)}>
              <View style={styles.circleTouchable} />
            </TouchableWithoutFeedback>
          </Animated.View>
        ))}
      </View>

      {/* Idle screen */}
      {gameState === 'idle' && (
        <View style={styles.overlay}>
          <Text style={styles.gameTitle}>TAP THE{'\n'}CIRCLE</Text>
          <Text style={styles.subtitle}>
            Tap circles before they disappear!{'\n'}Speed increases over time.
          </Text>
          {bestScore > 0 && (
            <Text style={styles.bestScoreText}>Best: {bestScore}</Text>
          )}
          <TouchableWithoutFeedback onPress={startGame}>
            <View style={styles.startButton}>
              <Text style={styles.startButtonText}>TAP TO PLAY</Text>
            </View>
          </TouchableWithoutFeedback>
        </View>
      )}

      {/* Game over screen */}
      {gameState === 'gameover' && (
        <View style={styles.overlay}>
          <Text style={styles.gameOverTitle}>GAME OVER</Text>
          <View style={styles.resultsCard}>
            <Text style={styles.resultLabel}>YOUR SCORE</Text>
            <Text style={styles.resultScore}>{score}</Text>
            {score >= bestScore && score > 0 && (
              <Text style={styles.newBestText}>NEW BEST!</Text>
            )}
            <View style={styles.divider} />
            <Text style={styles.resultLabel}>BEST SCORE</Text>
            <Text style={styles.resultBest}>{bestScore}</Text>
            <Text style={styles.missedText}>Missed: {missCount}</Text>
          </View>
          <TouchableWithoutFeedback onPress={startGame}>
            <View style={styles.startButton}>
              <Text style={styles.startButtonText}>PLAY AGAIN</Text>
            </View>
          </TouchableWithoutFeedback>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  hud: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#16213e',
    borderBottomWidth: 1,
    borderBottomColor: '#0f3460',
  },
  hudItem: {
    alignItems: 'center',
    minWidth: 70,
  },
  hudLabel: {
    color: '#8892a4',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
  },
  hudValue: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 2,
  },
  timerContainer: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 10,
  },
  timerText: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  timerBar: {
    width: '100%',
    height: 4,
    backgroundColor: '#0f3460',
    borderRadius: 2,
    overflow: 'hidden',
  },
  timerFill: {
    height: '100%',
    borderRadius: 2,
  },
  comboContainer: {
    alignItems: 'center',
    paddingVertical: 4,
    backgroundColor: '#e94560',
  },
  comboText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  gameArea: {
    flex: 1,
  },
  circle: {
    position: 'absolute',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
  },
  circleTouchable: {
    flex: 1,
    borderRadius: 999,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(26, 26, 46, 0.95)',
    paddingHorizontal: 30,
  },
  gameTitle: {
    color: '#ffffff',
    fontSize: 52,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 4,
    lineHeight: 60,
    marginBottom: 20,
  },
  subtitle: {
    color: '#8892a4',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 12,
  },
  bestScoreText: {
    color: '#F7DC6F',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
  },
  startButton: {
    backgroundColor: '#e94560',
    paddingHorizontal: 50,
    paddingVertical: 18,
    borderRadius: 50,
    marginTop: 20,
    shadowColor: '#e94560',
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 10,
  },
  startButtonText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 3,
  },
  gameOverTitle: {
    color: '#e94560',
    fontSize: 44,
    fontWeight: 'bold',
    letterSpacing: 4,
    marginBottom: 30,
  },
  resultsCard: {
    backgroundColor: '#16213e',
    borderRadius: 20,
    padding: 30,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  resultLabel: {
    color: '#8892a4',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2,
    marginTop: 10,
  },
  resultScore: {
    color: '#ffffff',
    fontSize: 64,
    fontWeight: 'bold',
    lineHeight: 72,
  },
  newBestText: {
    color: '#F7DC6F',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  divider: {
    width: '80%',
    height: 1,
    backgroundColor: '#0f3460',
    marginVertical: 16,
  },
  resultBest: {
    color: '#4ECDC4',
    fontSize: 36,
    fontWeight: 'bold',
  },
  missedText: {
    color: '#8892a4',
    fontSize: 14,
    marginTop: 10,
  },
});
