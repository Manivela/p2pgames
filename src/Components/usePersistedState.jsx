import React from "react";

export default (name, defaultValue = null) => {
  const [loading, setLoading] = React.useState(true);
  const [value, setValue] = React.useState(defaultValue);

  React.useEffect(() => {
    try {
      const storedValue = localStorage.getItem(name);
      if (storedValue !== null) {
        setValue(storedValue);
      }
    } catch (e) {
      console.log("error:", e);
      setValue(defaultValue);
    }
    setLoading(false);
  }, []);

  React.useEffect(() => {
    if (value !== null) {
      localStorage.setItem(name, value);
    } else {
      localStorage.removeItem(name);
    }
  }, [value]);

  return [value, setValue, loading];
};
