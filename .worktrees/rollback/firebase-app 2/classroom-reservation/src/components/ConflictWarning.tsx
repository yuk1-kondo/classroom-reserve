// 重複警告表示コンポーネント
import React from 'react';
import { ConflictCheckState } from '../hooks/useConflictDetection';

interface ConflictWarningProps {
  conflictCheck: ConflictCheckState;
}

export const ConflictWarning: React.FC<ConflictWarningProps> = ({
  conflictCheck
}) => {
  if (!conflictCheck.hasConflict) {
    return null;
  }

  return (
    <div className="conflict-warning">
      <div className="conflict-header">
        ⚠️ {conflictCheck.conflictMessage}
      </div>
      {conflictCheck.conflictDetails.length > 0 && (
        <div className="conflict-details">
          {conflictCheck.conflictDetails.map((detail, index) => (
            <div key={index} className="conflict-item">• {detail}</div>
          ))}
        </div>
      )}
    </div>
  );
};
