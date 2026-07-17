
// ============================================================
// FUZZY DDA ENGINE - TypeScript Implementation
// For your 2D RPG Educational Game (Phaser/Canvas/WebGL)
// ============================================================

// --- CORE TYPES ---

interface MembershipFunction {
  name: string;
  type: 'triangular' | 'trapezoidal';
  params: number[]; // [a, b, c] for triangular, [a, b, c, d] for trapezoidal
}

interface FuzzyInput {
  id: string;
  range: [number, number];
  unit: string;
  membershipFunctions: MembershipFunction[];
}

interface FuzzyOutput {
  id: string;
  range: [number, number];
  membershipFunctions: MembershipFunction[];
}

interface FuzzyRule {
  id: string;
  antecedents: { input: string; fuzzySet: string }[];
  consequents: { output: string; fuzzySet: string }[];
  weight: number;
}

interface RuleSet {
  ruleSetId: string;
  inputs: FuzzyInput[];
  outputs: FuzzyOutput[];
  rules: FuzzyRule[];
  defuzzification: {
    method: 'centroid' | 'bisector' | 'mom';
    outputAggregation: 'max' | 'sum';
  };
}

interface PerformanceSnapshot {
  responseTime: number;      // seconds
  errorRate: number;          // 0-100
  helpRequests: number;       // count
  retryCount: number;         // count
  engagementScore: number;    // 0-100 (derived from mouse movement, idle time, etc.)
  timestamp: number;
}

interface AdaptationResult {
  difficultyLevel: number;    // 0-100
  npcHelpfulness: number;     // 0-100
  timeLimit: number;           // seconds
  scaffoldingLevel: number;    // 0-100
  contentParams: any;          // subject-specific content parameters
}

// --- TRIANGULAR MEMBERSHIP FUNCTION ---
function triangularMF(x: number, a: number, b: number, c: number): number {
  if (x <= a || x >= c) return 0;
  if (x === b) return 1;
  if (x < b) return (x - a) / (b - a);
  return (c - x) / (c - b);
}

// --- TRAPEZOIDAL MEMBERSHIP FUNCTION ---
function trapezoidalMF(x: number, a: number, b: number, c: number, d: number): number {
  if (x <= a || x >= d) return 0;
  if (x >= b && x <= c) return 1;
  if (x < b) return (x - a) / (b - a);
  return (d - x) / (d - c);
}

// --- FUZZIFICATION: Crisp → Fuzzy ---
function fuzzify(value: number, mf: MembershipFunction): number {
  switch (mf.type) {
    case 'triangular':
      return triangularMF(value, mf.params[0], mf.params[1], mf.params[2]);
    case 'trapezoidal':
      return trapezoidalMF(value, mf.params[0], mf.params[1], mf.params[2], mf.params[3]);
    default:
      return 0;
  }
}

// --- INFERENCE ENGINE (Mamdani-style) ---
class FuzzyInferenceEngine {
  private ruleSet: RuleSet;

  constructor(ruleSet: RuleSet) {
    this.ruleSet = ruleSet;
  }

  evaluate(inputs: Record<string, number>): Record<string, number[]> {
    const firedRules: { rule: FuzzyRule; firingStrength: number }[] = [];

    // Step 1: Evaluate all rules
    for (const rule of this.ruleSet.rules) {
      let firingStrength = 1.0;

      // Calculate antecedent firing strength (AND = min)
      for (const antecedent of rule.antecedents) {
        const inputValue = inputs[antecedent.input];
        const inputDef = this.ruleSet.inputs.find(i => i.id === antecedent.input);
        if (!inputDef) continue;

        const mf = inputDef.membershipFunctions.find(m => m.name === antecedent.fuzzySet);
        if (!mf) continue;

        const membershipDegree = fuzzify(inputValue, mf);
        firingStrength = Math.min(firingStrength, membershipDegree);
      }

      if (firingStrength > 0) {
        firedRules.push({ rule, firingStrength: firingStrength * rule.weight });
      }
    }

    // Step 2: Aggregate outputs (Mamdani: max of minima)
    const outputAggregations: Record<string, number[]> = {};

    for (const output of this.ruleSet.outputs) {
      const range = output.range;
      const resolution = 100; // discretization steps
      const step = (range[1] - range[0]) / resolution;
      const aggregated = new Array(resolution + 1).fill(0);

      for (let i = 0; i <= resolution; i++) {
        const x = range[0] + i * step;
        let maxDegree = 0;

        for (const { rule, firingStrength } of firedRules) {
          for (const consequent of rule.consequents) {
            if (consequent.output !== output.id) continue;

            const mf = output.membershipFunctions.find(m => m.name === consequent.fuzzySet);
            if (!mf) continue;

            const degree = Math.min(firingStrength, fuzzify(x, mf));
            maxDegree = Math.max(maxDegree, degree);
          }
        }

        aggregated[i] = maxDegree;
      }

      outputAggregations[output.id] = aggregated;
    }

    return outputAggregations;
  }

  // --- DEFUZZIFICATION: Centroid Method ---
  defuzzify(aggregations: Record<string, number[]>): Record<string, number> {
    const results: Record<string, number> = {};

    for (const output of this.ruleSet.outputs) {
      const range = output.range;
      const aggregated = aggregations[output.id];
      if (!aggregated) continue;

      const resolution = aggregated.length - 1;
      const step = (range[1] - range[0]) / resolution;

      let numerator = 0;
      let denominator = 0;

      for (let i = 0; i <= resolution; i++) {
        const x = range[0] + i * step;
        const y = aggregated[i];
        numerator += x * y * step;
        denominator += y * step;
      }

      results[output.id] = denominator > 0 ? numerator / denominator : (range[0] + range[1]) / 2;
    }

    return results;
  }
}

// --- PERFORMANCE TRACKER ---
class PerformanceTracker {
  private history: PerformanceSnapshot[] = [];
  private maxHistorySize = 50;

  record(snapshot: PerformanceSnapshot): void {
    this.history.push(snapshot);
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }
  }

  getCurrentMetrics(): {
    responseTime: number;
    errorRate: number;
    helpRequests: number;
    retryCount: number;
    engagementScore: number;
  } {
    const recent = this.history.slice(-10); // last 10 interactions
    if (recent.length === 0) {
      return { responseTime: 30, errorRate: 50, helpRequests: 0, retryCount: 0, engagementScore: 50 };
    }

    return {
      responseTime: this.average(recent.map(r => r.responseTime)),
      errorRate: this.average(recent.map(r => r.errorRate)),
      helpRequests: this.average(recent.map(r => r.helpRequests)),
      retryCount: this.average(recent.map(r => r.retryCount)),
      engagementScore: this.average(recent.map(r => r.engagementScore))
    };
  }

  private average(values: number[]): number {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  // Detect frustration patterns (rapid retries + high errors)
  isFrustrated(): boolean {
    const recent = this.history.slice(-5);
    if (recent.length < 3) return false;

    const avgRetries = this.average(recent.map(r => r.retryCount));
    const avgErrors = this.average(recent.map(r => r.errorRate));
    const avgEngagement = this.average(recent.map(r => r.engagementScore));

    return avgRetries > 2 && avgErrors > 60 && avgEngagement < 40;
  }

  // Detect boredom (fast + low errors + low engagement)
  isBored(): boolean {
    const recent = this.history.slice(-5);
    if (recent.length < 3) return false;

    const avgTime = this.average(recent.map(r => r.responseTime));
    const avgErrors = this.average(recent.map(r => r.errorRate));
    const avgEngagement = this.average(recent.map(r => r.engagementScore));

    return avgTime < 10 && avgErrors < 20 && avgEngagement < 30;
  }
}

// --- ADAPTATION ENGINE ---
class AdaptiveContentEngine {
  private inferenceEngine: FuzzyInferenceEngine;
  private performanceTracker: PerformanceTracker;
  private adaptationMatrix: any;

  constructor(ruleSet: RuleSet, adaptationMatrix: any) {
    this.inferenceEngine = new FuzzyInferenceEngine(ruleSet);
    this.performanceTracker = new PerformanceTracker();
    this.adaptationMatrix = adaptationMatrix;
  }

  // Main entry point: called before each minigame/NPC interaction
  generateAdaptation(context: string): AdaptationResult {
    const metrics = this.performanceTracker.getCurrentMetrics();

    // Fuzzy inputs
    const inputs = {
      response_time: metrics.responseTime,
      error_rate: metrics.errorRate,
      help_requests: metrics.helpRequests,
      retry_count: metrics.retryCount
    };

    // Run fuzzy inference
    const aggregations = this.inferenceEngine.evaluate(inputs);
    const crispOutputs = this.inferenceEngine.defuzzify(aggregations);

    // Map to content parameters
    const contentParams = this.mapToContent(context, crispOutputs);

    // Override for extreme states (frustration/boredom detection)
    if (this.performanceTracker.isFrustrated()) {
      crispOutputs.difficulty_level = Math.max(0, crispOutputs.difficulty_level - 30);
      crispOutputs.npc_helpfulness = Math.min(100, crispOutputs.npc_helpfulness + 30);
      crispOutputs.scaffolding_level = Math.min(100, crispOutputs.scaffolding_level + 20);
    }

    if (this.performanceTracker.isBored()) {
      crispOutputs.difficulty_level = Math.min(100, crispOutputs.difficulty_level + 20);
      crispOutputs.time_limit = Math.max(10, crispOutputs.time_limit - 15);
    }

    return {
      difficultyLevel: crispOutputs.difficulty_level,
      npcHelpfulness: crispOutputs.npc_helpfulness,
      timeLimit: crispOutputs.time_limit,
      scaffoldingLevel: crispOutputs.scaffolding_level,
      contentParams
    };
  }

  private mapToContent(context: string, outputs: Record<string, number>): any {
    const matrix = this.adaptationMatrix[context];
    if (!matrix) return {};

    const result: any = {};

    for (const [outputId, value] of Object.entries(outputs)) {
      const outputMatrix = matrix[outputId];
      if (!outputMatrix) continue;

      for (const range of outputMatrix.ranges) {
        if (value >= range.min && value <= range.max) {
          result[outputId] = range.content || range;
          break;
        }
      }
    }

    return result;
  }

  // Called after each interaction to update performance data
  recordInteraction(snapshot: PerformanceSnapshot): void {
    this.performanceTracker.record(snapshot);
  }
}

// --- INTEGRATION WITH YOUR 2D RPG GAME ---

class GameDDAIntegration {
  private adaptiveEngine: AdaptiveContentEngine;
  private currentAdaptation: AdaptationResult | null = null;

  constructor(ruleSet: RuleSet, adaptationMatrix: any) {
    this.adaptiveEngine = new AdaptiveContentEngine(ruleSet, adaptationMatrix);
  }

  // Called when player approaches an NPC or enters a minigame zone
  async prepareInteraction(context: string, playerState: any): Promise<void> {
    this.currentAdaptation = this.adaptiveEngine.generateAdaptation(context);

    // Apply adaptation to game state BEFORE interaction starts
    await this.applyToNPC(context, this.currentAdaptation);
    await this.applyToMinigame(context, this.currentAdaptation);
    await this.applyToEnvironment(context, this.currentAdaptation);
  }

  private async applyToNPC(context: string, adaptation: AdaptationResult): Promise<void> {
    // 1. Adjust NPC dialogue tree based on npcHelpfulness
    const helpLevel = adaptation.npcHelpfulness;

    if (helpLevel < 20) {
      // Minimal help: NPC is neutral, no hints
      await this.setNPCDialogue(context, 'neutral', []);
    } else if (helpLevel < 70) {
      // Moderate help: NPC offers contextual hints after wrong answers
      await this.setNPCDialogue(context, 'encouraging', [
        'Hmm, that's not quite right. Think about what you did last time.',
        'Remember: you need to isolate the variable.',
        'Try subtracting first, then dividing.'
      ]);
    } else {
      // Proactive help: NPC acts as tutor, step-by-step guidance
      await this.setNPCDialogue(context, 'tutorial', [
        'Let me guide you through this. First, what do we need to move to the other side?',
        'Good! Now, what operation undoes multiplication?',
        'Excellent! Let's verify by substituting back.'
      ]);
    }
  }

  private async applyToMinigame(context: string, adaptation: AdaptationResult): Promise<void> {
    // 2. Adjust minigame parameters based on difficultyLevel and scaffoldingLevel
    const content = adaptation.contentParams;

    // Example: Algebra puzzle minigame
    if (context === 'algebra_linear') {
      const puzzle = {
        equation: content.difficulty_level?.example || 'x + 5 = 12',
        timeLimit: adaptation.timeLimit,
        maxHints: Math.floor(adaptation.scaffoldingLevel / 20),
        showVisualAid: adaptation.scaffoldingLevel > 50,
        allowRetry: adaptation.scaffoldingLevel > 30,
        retryPenalty: content.scaffolding_level?.retryPenalty || 'soft'
      };

      await this.loadPuzzle(puzzle);
    }

    // Example: 2D Platformer physics minigame
    if (context === 'platformer_physics') {
      const platformer = {
        gravity: 0.5 + (adaptation.difficultyLevel / 100) * 0.5,  // 0.5 to 1.0
        jumpForce: 12 - (adaptation.difficultyLevel / 100) * 4,    // 12 to 8
        obstacleDensity: Math.floor(adaptation.difficultyLevel / 20), // 0 to 5
        timeLimit: adaptation.timeLimit,
        showTrajectory: adaptation.scaffoldingLevel > 60,  // visual aid
        allowCheckpoint: adaptation.scaffoldingLevel > 40
      };

      await this.loadPlatformer(platformer);
    }
  }

  private async applyToEnvironment(context: string, adaptation: AdaptationResult): Promise<void> {
    // 3. Adjust environmental cues
    const scaffolding = adaptation.scaffoldingLevel;

    // Visual scaffolding: highlight interactive objects
    if (scaffolding > 50) {
      await this.highlightInteractiveObjects(true);
    }

    // Audio cues: encouraging music vs. tense music
    if (adaptation.npcHelpfulness > 70) {
      await this.setBackgroundMusic('calm_supportive');
    } else if (adaptation.difficultyLevel > 75) {
      await this.setBackgroundMusic('intense_challenge');
    }
  }

  // Called when interaction completes
  async finalizeInteraction(result: {
    success: boolean;
    timeSpent: number;
    errors: number;
    hintsUsed: number;
    retries: number;
  }): Promise<void> {
    const snapshot: PerformanceSnapshot = {
      responseTime: result.timeSpent,
      errorRate: (result.errors / Math.max(result.errors + (result.success ? 1 : 0), 1)) * 100,
      helpRequests: result.hintsUsed,
      retryCount: result.retries,
      engagementScore: this.calculateEngagement(result),
      timestamp: Date.now()
    };

    this.adaptiveEngine.recordInteraction(snapshot);
  }

  private calculateEngagement(result: any): number {
    // Simple engagement heuristic
    let score = 50;
    if (result.success) score += 20;
    if (result.retries > 0) score += 10; // persistence = engagement
    if (result.hintsUsed > 0 && result.hintsUsed < 3) score += 10; // strategic help use
    if (result.timeSpent < 5) score -= 20; // too fast = guessing
    return Math.max(0, Math.min(100, score));
  }

  // Stub methods (implement with your game engine)
  private async setNPCDialogue(context: string, style: string, hints: string[]): Promise<void> {
    // Integrate with your NPC dialogue system
    console.log(`[DDA] NPC ${context} set to ${style} mode with ${hints.length} hints`);
  }

  private async loadPuzzle(puzzle: any): Promise<void> {
    // Integrate with your minigame loader
    console.log(`[DDA] Loading puzzle:`, puzzle);
  }

  private async loadPlatformer(params: any): Promise<void> {
    // Integrate with your platformer scene
    console.log(`[DDA] Loading platformer:`, params);
  }

  private async highlightInteractiveObjects(enable: boolean): Promise<void> {
    // Integrate with your renderer
    console.log(`[DDA] Interactive object highlights: ${enable}`);
  }

  private async setBackgroundMusic(track: string): Promise<void> {
    // Integrate with your audio system
    console.log(`[DDA] Background music: ${track}`);
  }
}

// --- USAGE EXAMPLE ---

async function exampleUsage() {
  // 1. Load rule set from JSON (teacher-configured)
  const ruleSet: RuleSet = await fetch('/rules/algebra_linear.json').then(r => r.json());
  const adaptationMatrix = await fetch('/matrices/algebra_linear.json').then(r => r.json());

  // 2. Initialize DDA integration
  const dda = new GameDDAIntegration(ruleSet, adaptationMatrix);

  // 3. Player approaches NPC in Math Forest
  await dda.prepareInteraction('algebra_linear', { playerLevel: 5, topic: 'linear_equations' });

  // 4. Minigame runs with adapted parameters...
  // ... (player solves puzzle or fails) ...

  // 5. Record results
  await dda.finalizeInteraction({
    success: false,
    timeSpent: 45,
    errors: 3,
    hintsUsed: 2,
    retries: 1
  });

  // 6. Next interaction will be adapted based on this performance!
}

export {
  FuzzyInferenceEngine,
  PerformanceTracker,
  AdaptiveContentEngine,
  GameDDAIntegration,
  triangularMF,
  trapezoidalMF,
  fuzzify
};