// The D1 primary's serialized write clock is the authoritative receipt timestamp.
// A single UPDATE both opens the fixed window and inserts one unique participant.
export const NOW = "CAST(unixepoch('subsec') * 1000 AS INTEGER)";
export const PRESS_SQL = `UPDATE death_rooms SET state=json_set(state,
 '$.phase','collecting',
 '$.deadline',CASE WHEN json_extract(state,'$.phase')='collecting'
   THEN json_extract(state,'$.deadline') ELSE ${NOW}+200 END,
 '$.inputs',json_insert(json_extract(state,'$.inputs'),'$[#]',?)),revision=revision+1
 WHERE code=? AND expires>${NOW}
 AND json_extract(state,'$.round')=? AND json_extract(state,'$.gate')=?
 AND json_extract(state,'$.count')<15
 AND json_extract(state,'$.rulesVersion')=3
 AND EXISTS(SELECT 1 FROM json_each(state,'$.players') WHERE json_extract(value,'$.id')=? AND json_extract(value,'$.key')=?
   AND NOT (json_extract(state,'$.mode')='team' AND json_extract(state,'$.streak')>=2 AND json_extract(state,'$.lastPlayer')=json_extract(value,'$.id')))
 AND NOT EXISTS(SELECT 1 FROM json_each(state,'$.inputs') WHERE value=?)
 AND (json_extract(state,'$.phase')='open'
 OR (json_extract(state,'$.phase') IN ('ready','cooldown') AND ${NOW}>=json_extract(state,'$.unlockAt'))
 OR (json_extract(state,'$.phase')='collecting' AND ${NOW}<=json_extract(state,'$.deadline')))`;
