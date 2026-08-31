import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';
import { colors, white } from '../../theme';

interface Props {
  value: boolean;
  onChange: (v: boolean) => void;
  // Requis (pas de valeur par défaut sensée) : ce composant n'affiche
  // lui-même aucun texte — le libellé vit dans le Text voisin posé par
  // l'appelant, invisible pour un lecteur d'écran sans ce prop.
  accessibilityLabel: string;
}

const TRACK_WIDTH = 48;
const TRACK_HEIGHT = 28;
const THUMB_SIZE = 20;
const THUMB_MARGIN = 4;

// Switch on/off custom (orange de marque quand actif), voir GoalCard/
// SettingsScreen dans le prototype pour l'usage.
export default function Toggle({ value, onChange, accessibilityLabel }: Props) {
  // useState (initialiseur paresseux) plutôt que useRef : on veut une
  // Animated.Value stable entre les rendus, sans jamais appeler de setter —
  // useRef déclenche la règle eslint react-hooks/refs sur .interpolate().
  const [anim] = useState(() => new Animated.Value(value ? 1 : 0));

  useEffect(() => {
    Animated.timing(anim, {
      toValue: value ? 1 : 0,
      duration: 200,
      // On anime backgroundColor + left, pas de transform : useNativeDriver
      // ne supporte pas ces propriétés.
      useNativeDriver: false,
    }).start();
  }, [value, anim]);

  const trackColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [white(0.2), colors.brand],
  });
  const thumbLeft = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [THUMB_MARGIN, TRACK_WIDTH - THUMB_SIZE - THUMB_MARGIN],
  });

  return (
    // TalkBack a annoncé "bouton" et non "interrupteur" en test sur Android
    // 16 / One UI 8. Rien trouvé de concret à corriger côté RN 0.86 après
    // vérification dans les sources (node_modules/react-native) :
    //  - accessibilityRole="switch" est bien une valeur supportée
    //    (ViewAccessibility.js) et Pressable la transmet telle quelle, en
    //    reconstruisant accessibilityState.checked au passage (Pressable.js) ;
    //  - côté Android, ReactAccessibilityDelegate.setRole() pose pour SWITCH
    //    className = "android.widget.Switch", et isCheckable/isChecked
    //    viennent uniquement de accessibilityState.checked — donc le noeud
    //    d'accessibilité produit ici est déjà celui attendu ;
    //  - migrer vers la prop unifiée `role="switch"` ne changerait rien :
    //    fromRole(Role.SWITCH) retombe sur le même AccessibilityRole.SWITCH,
    //    et accessibilityRole n'est pas marqué déprécié en 0.86 ;
    //  - aucun ticket RN connu sur ce cas précis (#50123, qui liste les rôles
    //    sans effet sur Android, ne mentionne pas "switch").
    // À noter : le <Switch> de RN ne passe pas par ce chemin, il rend un vrai
    // widget natif SwitchCompat — un Pressable ne peut que *déclarer* le
    // className, c'est ensuite TalkBack qui décide de l'annonce. Piste à
    // reprendre au prochain test terrain : vérifier si l'état
    // ("activé"/"désactivé") est bien annoncé — si oui, checked passe et seul
    // le mot du rôle diffère, ce qui pointe vers le TalkBack de l'appareil
    // plutôt que vers l'app. À revérifier aussi sous iOS/VoiceOver.
    <Pressable
      onPress={() => onChange(!value)}
      hitSlop={8}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View style={[styles.track, { backgroundColor: trackColor }]}>
        <Animated.View style={[styles.thumb, { left: thumbLeft }]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    justifyContent: 'center',
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: '#fff',
  },
});
