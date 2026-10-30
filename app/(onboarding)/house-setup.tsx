import { useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { useHouseSetup } from '@hooks/useHouseSetup';
import { AuthScreen } from '@components/auth/AuthScreen';
import { AuthField } from '@components/auth/AuthField';
import { SetupChoice } from '@components/onboarding/SetupChoice';
import { JoinConfirmSheet } from '@components/onboarding/JoinConfirmSheet';
import { SheetButton } from '@components/shared/SheetButton';
import { mf, ms } from '@utils/responsive';

export default function HouseSetupScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const C = useThemedColors();
  const {
    mode,
    setMode,
    houseName,
    setHouseName,
    inviteCode,
    setInviteCode,
    isLoading,
    error,
    setError,
    assignedColor,
    pendingHouse,
    showConfirm,
    setShowConfirm,
    signOut,
    handleCreate,
    handleFindHouse,
    handleConfirmJoin,
  } = useHouseSetup();

  const pickCreate = useCallback((): void => {
    setMode('create');
    setError('');
  }, [setMode, setError]);
  const pickJoin = useCallback((): void => {
    setMode('join');
    setError('');
  }, [setMode, setError]);
  const closeConfirm = useCallback((): void => setShowConfirm(false), [setShowConfirm]);

  return (
    <>
      <AuthScreen
        title={t('house_setup.title')}
        subtitle={t('house_setup.subtitle')}
        onBack={() => signOut()}
        backLabel={t('house_setup.back_to_login')}
      >
        <View style={styles.choices}>
          <SetupChoice
            kind="create"
            title={t('house_setup.create_house')}
            subtitle={t('house_setup.create_house_sub')}
            selected={mode === 'create'}
            onPress={pickCreate}
          />
          <SetupChoice
            kind="join"
            title={t('house_setup.join_house')}
            subtitle={t('house_setup.join_house_sub')}
            selected={mode === 'join'}
            onPress={pickJoin}
          />
        </View>

        {mode === 'create' ? (
          <>
            <AuthField
              label={t('house_setup.house_name_placeholder')}
              value={houseName}
              onChangeText={(v) => {
                setHouseName(v);
                setError('');
              }}
              autoFocus
              returnKeyType="go"
              onSubmitEditing={handleCreate}
              error={!!error}
              placeholder={t('house_setup.house_name_placeholder')}
              accessibilityLabel={t('house_setup.house_name_label')}
              accessibilityHint={t('house_setup.house_name_hint')}
            />

            {!!error && <Text style={[styles.error, { color: C.danger }]}>{error}</Text>}

            <SheetButton
              label={t('house_setup.create_house')}
              onPress={handleCreate}
              loading={isLoading}
              disabled={isLoading}
            />
          </>
        ) : (
          <>
            <View>
              <AuthField
                code
                label={t('house_setup.invite_code')}
                value={inviteCode}
                onChangeText={(v) => {
                  setInviteCode(v.toUpperCase());
                  setError('');
                }}
                autoCapitalize="characters"
                autoCorrect={false}
                autoFocus
                returnKeyType="go"
                onSubmitEditing={handleFindHouse}
                error={!!error}
                placeholder="XXXXXXXX"
                accessibilityLabel={t('house_setup.invite_code')}
                accessibilityHint={t('house_setup.invite_code_hint')}
              />
              <Text style={[styles.codeHint, { color: C.textTertiary }]}>
                {t('house_setup.code_hint')}
              </Text>
            </View>

            {!!error && <Text style={[styles.error, { color: C.danger }]}>{error}</Text>}

            {assignedColor && (
              <View style={styles.colorNotice}>
                <View style={[styles.colorDot, { backgroundColor: assignedColor }]} />
                <Text style={[styles.colorText, { color: C.textSecondary }]}>
                  {t('house_setup.color_updated')}
                </Text>
              </View>
            )}

            <SheetButton
              label={t('house_setup.find_house')}
              onPress={handleFindHouse}
              loading={isLoading}
              disabled={isLoading || inviteCode.trim().length < 8}
            />
          </>
        )}
      </AuthScreen>

      <JoinConfirmSheet
        visible={showConfirm}
        code={inviteCode.trim().toUpperCase()}
        house={pendingHouse}
        isLoading={isLoading}
        onConfirm={handleConfirmJoin}
        onClose={closeConfirm}
      />
    </>
  );
}

const styles = StyleSheet.create({
  choices: { flexDirection: 'row', gap: ms(14), marginBottom: ms(6) },
  error: { fontSize: mf(14), ...font.medium, lineHeight: mf(20) },
  codeHint: { fontSize: mf(13), ...font.regular, lineHeight: mf(18), marginTop: ms(8) },
  colorNotice: { flexDirection: 'row', alignItems: 'center', gap: ms(10) },
  colorDot: { width: ms(14), height: ms(14), borderRadius: ms(7) },
  colorText: { flex: 1, fontSize: mf(14), ...font.regular, lineHeight: mf(20) },
});
