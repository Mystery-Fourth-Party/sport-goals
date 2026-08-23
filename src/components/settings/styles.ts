// Styles partagés entre app/settings.tsx et ses sous-composants
// (NotificationsSection, DataSection) — la carte "Application" restée
// inline dans app/settings.tsx les utilise aussi. Scopé à cet écran
// plutôt qu'ajouté à theme.ts : ce sont des compositions (carte + ligne +
// libellés) spécifiques à ce layout, pas des tokens de design system.
import { StyleSheet } from 'react-native';
import { colors, fontFamily, radius, spacing, white } from '../../theme';

export const settingsStyles = StyleSheet.create({
  sectionLabel: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: white(0.3),
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  sectionLabelSpaced: {
    marginTop: 24,
  },
  errorText: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 12,
    color: colors.late,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.cardPadding,
    paddingVertical: 16,
    gap: 12,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: white(0.05),
  },
  rowTexts: {
    flexShrink: 1,
  },
  rowTitle: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 14,
    color: colors.fg,
  },
  rowTitlePlain: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 14,
    color: colors.fg,
  },
  rowSubtitle: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 12,
    color: white(0.35),
    marginTop: 2,
  },
  rowChevron: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 20,
    color: white(0.25),
  },
});
