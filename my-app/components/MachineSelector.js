import React from 'react';

const MachineSelector = ({ selectedMachine, onMachineChange }) => {
  return (
    <select
      value={selectedMachine}
      onChange={(e) => onMachineChange(e.target.value)}
      style={{
        padding: "8px 12px",
        borderRadius: "8px",
        border: "1px solid #e0e0e0",
        backgroundColor: "white",
        minWidth: "150px",
        fontSize: "14px"
      }}
    >
      <option value="automate1">Station 1</option>
      <option value="automate2">Station 2</option>
      <option value="automate3">Station 3</option>
    </select>
  );
};

export default MachineSelector; 