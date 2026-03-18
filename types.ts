
export interface Character {
  id: string;
  name: string;
  species: string;
  gender: string;
  age: string;
  voice_personality: string;
  body_build: string;
  face_shape: string;
  hair: string;
  skin_or_fur_color: string;
  signature_feature: string;
  outfit_top: string;
  outfit_bottom: string;
  helmet_or_hat: string;
  shoes_or_footwear: string;
  props: string;
  body_metrics: string;
  position: string;
  orientation: string;
  pose: string;
  foot_placement: string;
  hand_detail: string;
  expression: string;
  action_flow: {
    pre_action: string;
    main_action: string;
    post_action: string;
  };
}

export interface Background {
  id: string;
  name: string;
  setting: string;
  scenery: string;
  props: string;
  lighting: string;
}

export interface SceneJson {
  scene_id: string;
  duration_sec: string;
  visual_style: string;
  character_lock: Record<string, Character>;
  background_lock: Record<string, Background>;
  camera: {
    framing: string;
    angle: string;
    movement: string;
    focus: string;
  };
  foley_and_ambience: {
    ambience: string[];
    fx: string[];
    music: string;
  };
  dialogue: Array<{
    speaker: string;
    voice: string;
    language: string;
    line: string;
  }>;
  lip_sync_director_note: string;
}

export interface AnalysisResult {
  raw: string;
  scenes: SceneJson[];
}

export interface BulkVideoItem {
  id: string;
  file: File;
  previewUrl: string;
  status: 'idle' | 'processing' | 'completed' | 'error';
  scenes: SceneJson[];
  error?: string;
}
