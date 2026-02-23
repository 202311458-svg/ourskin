type Props = {

  text: string;
  onClick?: () => void;

};

export default function Button({ text, onClick }: Props) {

  return (

    <button
      onClick={onClick}
      className="px-5 py-2 text-white bg-black rounded"
    >
      {text}
    </button>

  );

}