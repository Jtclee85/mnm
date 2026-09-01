  /**
   * 뭐냐면 익명 학습산출물 수집기
   *
   * Apps Script의 "스크립트 속성"에 다음 값을 설정한 뒤 웹 앱으로 배포한다.
   * - SHEET_ID: 저장할 Google Sheet ID
   * - SHEET_NAME: 저장할 탭 이름 (예: artifacts)
   * - ARTIFACT_APP_ID: 클라이언트의 NEXT_PUBLIC_ARTIFACT_APP_ID와 같은 공개 식별값
   *
   * ARTIFACT_APP_ID는 브라우저에 노출되므로 비밀키가 아니다. 다른 폼의 우발적인 요청을
   * 구분하는 용도일 뿐이며, 강한 인증 수단으로 사용하지 않는다.
   */

  const CONFIG = Object.freeze({
    sheetIdProperty: 'SHEET_ID',
    sheetNameProperty: 'SHEET_NAME',
    appIdProperty: 'ARTIFACT_APP_ID',
    maxBodyCharacters: 120000,
  });

  const COLUMNS = Object.freeze([
    'timestamp',
    'artifact_id',
    'anonymous_id',
    'app_identifier',
    'app_version',
    'activity_mode',
    'topic',
    'source_title',
    'source_url',
    'output_type',
    'understanding_check_1',
    'understanding_check_2',
    'understanding_check_3',
    'understanding_check_4',
    'student_question',
    'question_type',
    'thought_before',
    'thought_reason',
    'new_learning',
    'thought_change_or_further_question',
    'presentation_core_message',
    'presentation_point_1',
    'presentation_point_2',
    'presentation_point_3',
    'presentation_expected_question',
    'presentation_prepared_answer',
    'presentation_opening_sentence',
    'presentation_closing_sentence',
    'writing_topic_sentence',
    'writing_support_1',
    'writing_support_2',
    'writing_support_3',
    'writing_evidence',
    'writing_closing_thought',
    'writing_opening_sentence',
    'writing_closing_sentence',
    'evidence_claim',
    'evidence_1',
    'evidence_2',
    'evidence_connection',
    'evidence_final_expression',
  ]);

  function doGet() {
    // GET으로 시트 내용이나 설정을 반환하지 않는다.
    return jsonResponse_({ ok: false, error: 'method_not_allowed' });
  }

  function doPost(e) {
    try {
      const rawBody = e && e.postData && e.postData.contents;
      if (!rawBody || rawBody.length > CONFIG.maxBodyCharacters) {
        return jsonResponse_({ ok: false, error: 'invalid_body' });
      }

      let payload;
      try {
        payload = JSON.parse(rawBody);
      } catch (_error) {
        return jsonResponse_({ ok: false, error: 'invalid_json' });
      }

      const validationError = validatePayload_(payload);
      if (validationError) return jsonResponse_({ ok: false, error: validationError });

      const properties = PropertiesService.getScriptProperties();
      const sheetId = properties.getProperty(CONFIG.sheetIdProperty);
      const sheetName = properties.getProperty(CONFIG.sheetNameProperty);
      const expectedAppId = properties.getProperty(CONFIG.appIdProperty);
      if (!sheetId || !sheetName || !expectedAppId) {
        return jsonResponse_({ ok: false, error: 'server_not_configured' });
      }
      if (payload.appIdentifier !== expectedAppId) {
        return jsonResponse_({ ok: false, error: 'invalid_app_identifier' });
      }

      const lock = LockService.getScriptLock();
      if (!lock.tryLock(10000)) return jsonResponse_({ ok: false, error: 'server_busy' });

      try {
        const spreadsheet = SpreadsheetApp.openById(sheetId);
        const sheet = spreadsheet.getSheetByName(sheetName);
        if (!sheet) return jsonResponse_({ ok: false, error: 'sheet_not_found' });

        ensureHeader_(sheet);
        if (artifactExists_(sheet, payload.artifactId)) {
          return jsonResponse_({ ok: true, duplicate: true, artifactId: payload.artifactId });
        }

        sheet.appendRow(buildRow_(payload));
        return jsonResponse_({ ok: true, duplicate: false, artifactId: payload.artifactId });
      } finally {
        lock.releaseLock();
      }
    } catch (_error) {
      // 원문이나 계정·시트 정보를 응답에 포함하지 않는다.
      return jsonResponse_({ ok: false, error: 'internal_error' });
    }
  }

  function validatePayload_(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return 'invalid_payload';
    const requiredStrings = ['timestamp', 'artifactId', 'anonymousId', 'appIdentifier', 'activityMode', 'topic', 'outputType'];
    for (let i = 0; i < requiredStrings.length; i += 1) {
      const key = requiredStrings[i];
      if (typeof payload[key] !== 'string' || !payload[key].trim()) return 'missing_' + key;
    }
    if (!isUuid_(payload.artifactId)) return 'invalid_artifact_id';
    if (!isUuid_(payload.anonymousId)) return 'invalid_anonymous_id';
    if (isNaN(Date.parse(payload.timestamp))) return 'invalid_timestamp';
    return '';
  }

  function isUuid_(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }

  function ensureHeader_(sheet) {
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(COLUMNS);
      sheet.setFrozenRows(1);
      return;
    }

    const current = sheet.getRange(1, 1, 1, COLUMNS.length).getDisplayValues()[0];
    if (current.join('\u0000') !== COLUMNS.join('\u0000')) {
      throw new Error('unexpected_sheet_header');
    }
  }

  function artifactExists_(sheet, artifactId) {
    if (sheet.getLastRow() < 2) return false;
    const artifactColumn = COLUMNS.indexOf('artifact_id') + 1;
    return sheet
      .getRange(2, artifactColumn, sheet.getLastRow() - 1, 1)
      .createTextFinder(artifactId)
      .matchEntireCell(true)
      .findNext() !== null;
  }

  function buildRow_(payload) {
    const u = objectOrEmpty_(payload.understanding);
    const i = objectOrEmpty_(payload.inquiry);
    const p = objectOrEmpty_(payload.presentation);
    const w = objectOrEmpty_(payload.writing);
    const e = objectOrEmpty_(payload.legacyEvidence);

    const values = {
      timestamp: new Date().toISOString(),
      artifact_id: payload.artifactId,
      anonymous_id: payload.anonymousId,
      app_identifier: payload.appIdentifier,
      app_version: payload.appVersion,
      activity_mode: payload.activityMode,
      topic: payload.topic,
      source_title: payload.sourceTitle,
      source_url: payload.sourceUrl,
      output_type: payload.outputType,
      understanding_check_1: u.check1,
      understanding_check_2: u.check2,
      understanding_check_3: u.check3,
      understanding_check_4: u.check4,
      student_question: i.selectedQuestion,
      question_type: i.selectedQuestionType,
      thought_before: i.firstThought,
      thought_reason: i.reason,
      new_learning: i.learnedAfterChat,
      thought_change_or_further_question: i.changedOrFurtherQuestion,
      presentation_core_message: p.coreMessage,
      presentation_point_1: p.point1,
      presentation_point_2: p.point2,
      presentation_point_3: p.point3,
      presentation_expected_question: p.expectedQuestion,
      presentation_prepared_answer: p.preparedAnswer,
      presentation_opening_sentence: p.openingSentence,
      presentation_closing_sentence: p.closingSentence,
      writing_topic_sentence: w.topicSentence,
      writing_support_1: w.support1,
      writing_support_2: w.support2,
      writing_support_3: w.support3,
      writing_evidence: w.evidence,
      writing_closing_thought: w.closingThought,
      writing_opening_sentence: w.openingSentence,
      writing_closing_sentence: w.closingSentence,
      evidence_claim: e.claim,
      evidence_1: e.evidence1,
      evidence_2: e.evidence2,
      evidence_connection: e.connection,
      evidence_final_expression: e.final,
    };

    return COLUMNS.map(column => safeCell_(values[column]));
  }

  function objectOrEmpty_(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function safeCell_(value) {
    const text = value == null ? '' : String(value).slice(0, 5000);
    // 학생 입력이 수식으로 실행되는 CSV/Sheets formula injection을 막는다.
    return /^[=+\-@]/.test(text) ? "'" + text : text;
  }

  function jsonResponse_(body) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}
