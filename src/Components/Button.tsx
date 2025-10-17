interface Props {
  children: string;
  onClicked: () => void;
}

function Button({ children, onClicked }: Props) {
  return (
    <button className="btn btn-primary" onClick={onClicked}>
      <>{children}</>
    </button>
  );
}

export default Button;
